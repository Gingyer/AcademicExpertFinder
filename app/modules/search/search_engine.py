from pathlib import Path
from typing import List, Tuple

from app.shared.models.llm_response import LLMSearchOutput
from app.modules.document.professor import Professor, professor_id
from app.shared.models.search import ProfessorResult, SearchRequest, SearchResponse, WorkSummary
from app.modules.ai.ports import LLMProvider
from app.modules.search.ports import VectorIndexPort
from app.modules.search.llm_parser import parse_llm_output_with_retry
from app.modules.document.professor_loader import load_professors
from app.shared.progress import (
    CancelCheck,
    ProgressCallback,
    SearchCancelled,
    never_cancel,
    noop_progress,
)

# ドメインは具体技術(Chroma 等)を知らない。ベクトル索引は VectorIndexPort として
# 注入され、その生成(Adapter)は Composition Root(app.container)が担う。

_SCORE_THRESHOLD = 85
_TOP_K = 5
_DEFAULT_DATA = Path(__file__).resolve().parents[2] / "data" / "professors_with_abstracts_v2.1.json"

_MAX_WORKS_FOR_EMBED = 5
_SUMMARY_CHARS_FOR_EMBED = 400


def _professor_to_text(prof: Professor) -> str:
    work_lines = []
    for w in prof.representative_works[:_MAX_WORKS_FOR_EMBED]:
        line = w.title
        if w.summary:
            line += f"\n  要約: {w.summary[:_SUMMARY_CHARS_FOR_EMBED]}"
        work_lines.append(line)
    works = "\n".join(work_lines)
    keywords = "・".join(prof.research_keywords)
    return (
        f"教授名：{prof.name}\n"
        f"キャンパス：{prof.school}\n"
        f"プロフィール：{prof.profile}\n"
        f"代表的な研究：\n{works}\n"
        f"研究キーワード：{keywords}"
    )


def _detect_intent(query: str) -> str:
    detail_hints = ["について教えて", "について知りたい", "とはどんな", "先生について", "教授について"]
    if any(h in query for h in detail_hints):
        return "professor_detail"
    return "professor_recommendation"


def _match_reason(prof: Professor, query: str) -> str:
    matched = [k for k in prof.research_keywords if k in query]
    if matched:
        return f"「{'・'.join(matched)}」に関する研究がご興味と一致しています。"
    top_kw = prof.research_keywords[0] if prof.research_keywords else "研究テーマ"
    return f"「{top_kw}」など近い分野の研究があります。"


def _build_query_expansion_prompt(query: str) -> str:
    return (
        f"ユーザーが大学教授を探しています。以下の検索クエリの意味を理解し、"
        "大学の研究分野・専門領域の観点から解釈してください。\n"
        "関連する学術キーワード・研究テーマ・応用分野を含む、"
        "ベクトル検索に適した検索テキストを1〜3文で生成してください。\n"
        "余分な説明は不要です。生成したテキストのみ返してください。\n\n"
        f"ユーザーのクエリ：「{query}」"
    )


def _build_llm_prompt(query: str, candidates: List[Tuple[Professor, int, float]]) -> str:
    prof_lines = []
    for prof, score, _sim in candidates:
        works_detail = []
        for w in prof.representative_works[:3]:
            work_str = f"  - {w.title}"
            if w.summary:
                work_str += f"\n    要約: {w.summary[:300]}"
            works_detail.append(work_str)
        works_text = "\n".join(works_detail)
        kws = "・".join(prof.research_keywords[:5])
        prof_lines.append(
            f"\n■ {prof.name}（{prof.school}） ベクトル類似スコア: {score}\n"
            f"  プロフィール: {prof.profile[:300]}\n"
            f"  研究キーワード: {kws}\n"
            f"  代表的な研究:\n{works_text}"
        )
    candidates_text = "\n".join(prof_lines)
    return (
        f"ユーザーの検索クエリ: 「{query}」\n\n"
        "以下の候補教授リストを参考に、クエリに最も関連する教授を選んでください。\n"
        "各教授について、なぜユーザーのニーズに合うのかをわかりやすい日本語で説明してください。\n\n"
        f"【候補教授リスト】{candidates_text}\n\n"
        "以下のJSON形式のみで回答してください（前後に説明文を付けないこと）:\n"
        "```json\n"
        "{\n"
        '  "query_intent": "クエリの意図を1文で要約",\n'
        '  "matches": [\n'
        "    {\n"
        '      "name": "教授名（候補リストと完全一致）",\n'
        '      "school": "学校名（候補リストと完全一致）",\n'
        '      "match_score": 関連度(0-100の整数),\n'
        '      "reason": "ユーザーのクエリにどう合うかをわかりやすく説明した文章"\n'
        "    }\n"
        "  ],\n"
        '  "confidence": "high または low",\n'
        '  "note": null\n'
        "}\n"
        "```"
    )


class SearchEngine:
    def __init__(
        self,
        store: VectorIndexPort,
        professors_path: Path = _DEFAULT_DATA,
        llm: LLMProvider | None = None,
    ) -> None:
        self._llm = llm
        self._professors: List[Professor] = load_professors(professors_path)
        self._professors_by_id = {professor_id(p): p for p in self._professors}
        # ベクトル索引は Port として注入される（具体 Adapter は container が生成）。
        self._store: VectorIndexPort = store
        if not self._store.is_indexed(self._professors):
            documents = [_professor_to_text(p) for p in self._professors]
            self._store.build_index(self._professors, documents)

    def _expand_query_with_llm(self, query: str) -> str:
        prompt = _build_query_expansion_prompt(query)
        try:
            expanded = self._llm.generate(prompt)  # type: ignore[union-attr]
            return expanded.strip()
        except Exception:
            return f"大学の研究分野として {query}"

    def _score_all(self, query: str) -> List[Tuple[Professor, int, float]]:
        hits = self._store.query(query, n_results=_TOP_K)
        scored = [
            (self._professors_by_id[id_], round(max(0.0, sim) * 100), max(0.0, sim))
            for id_, sim in hits
            if id_ in self._professors_by_id
        ]
        return sorted(scored, key=lambda x: x[1], reverse=True)

    def _refine_with_llm(
        self,
        candidates: List[Tuple[Professor, int, float]],
        query: str,
        query_type: str,
        attempts: int,
        is_confident: bool,
    ) -> SearchResponse:
        prompt = _build_llm_prompt(query, candidates)
        llm_output: LLMSearchOutput = parse_llm_output_with_retry(
            fetch=lambda: self._llm.generate(prompt),  # type: ignore[union-attr]
            model=LLMSearchOutput,
        )
        candidates_map = {(p.name, p.school): (p, sim) for p, _, sim in candidates}
        results = []
        for item in llm_output.matches:
            entry = candidates_map.get((item.name, item.school))
            if entry is None:
                continue
            prof, sim = entry
            results.append(
                ProfessorResult(
                    name=item.name,
                    school=item.school,
                    url=prof.url,
                    match_score=item.match_score,
                    similarity_score=sim,
                    match_reason=item.reason,
                    profile_summary=prof.profile[:200],
                    related_keywords=prof.research_keywords[:5],
                    confidence_note=(
                        "関連度が85未満のため、参考候補として表示しています。"
                        if item.match_score < _SCORE_THRESHOLD
                        else None
                    ),
                    related_works=[
                        WorkSummary(title=w.title, abstract=w.summary)
                        for w in prof.representative_works[:3]
                    ],
                )
            )
        if not results:
            raise ValueError("LLM returned no known candidates")
        return SearchResponse(
            query_type=query_type,
            confidence="high" if is_confident else "low",
            is_confident=is_confident,
            message=llm_output.note,
            search_attempts=attempts,
            results=results,
        )

    def search(
        self,
        request: SearchRequest,
        on_progress: ProgressCallback = noop_progress,
        should_cancel: CancelCheck = never_cancel,
    ) -> SearchResponse:
        # 各ステージの開始直前にキャンセルを確認し、立っていれば次ステージに入らず終了する。
        # （実行中のステージは強制停止しない。「次に進ませない」ことが要件。）
        def checkpoint(stage: str, percent: int, message: str) -> None:
            if should_cancel():
                raise SearchCancelled()
            on_progress(stage, percent, message)

        checkpoint("解析", 5, "入力内容を解析しています")
        query_type = _detect_intent(request.query)

        checkpoint("検索", 20, "関連する研究分野を検索しています")
        scored = self._score_all(request.query)
        confident = [(p, s, sim) for p, s, sim in scored if s >= _SCORE_THRESHOLD]
        if confident:
            candidates = confident[:5]
            is_confident = True
            attempts = 1
        else:
            checkpoint("候補拡張", 40, "検索条件を広げて再検索しています")
            if self._llm is not None:
                expanded = self._expand_query_with_llm(request.query)
            else:
                expanded = f"大学の研究分野として {request.query}"
            scored2 = self._score_all(expanded)
            confident2 = [(p, s, sim) for p, s, sim in scored2 if s >= _SCORE_THRESHOLD]
            if confident2:
                candidates = confident2[:5]
                is_confident = True
            else:
                candidates = scored[:5]
                is_confident = False
            attempts = 2

        if self._llm is not None and candidates:
            checkpoint("要約生成", 65, "候補を分析し、要約を作成しています")
            try:
                return self._refine_with_llm(candidates, request.query, query_type, attempts, is_confident)
            except SearchCancelled:
                raise
            except Exception:
                pass

        checkpoint("仕上げ", 90, "結果をまとめています")
        message = (
            "関連度85以上の結果は見つかりませんでした。近い可能性がある教授を上位順に表示しています。"
            if not is_confident
            else None
        )
        return self._build_response(candidates, request.query, query_type, attempts, is_confident, message)

    def _build_response(
        self,
        scored: List[Tuple[Professor, int, float]],
        query: str,
        query_type: str,
        attempts: int,
        is_confident: bool,
        message: str | None = None,
    ) -> SearchResponse:
        results = [
            ProfessorResult(
                name=p.name,
                school=p.school,
                url=p.url,
                match_score=s,
                similarity_score=sim,
                match_reason=_match_reason(p, query),
                profile_summary=p.profile[:200],
                related_keywords=p.research_keywords[:5],
                confidence_note=(
                    "関連度が85未満のため、参考候補として表示しています。"
                    if not is_confident
                    else None
                ),
                related_works=[
                    WorkSummary(title=w.title, abstract=w.summary)
                    for w in p.representative_works[:3]
                ],
            )
            for p, s, sim in scored
        ]
        return SearchResponse(
            query_type=query_type,
            confidence="high" if is_confident else "low",
            is_confident=is_confident,
            message=message,
            search_attempts=attempts,
            results=results,
        )
