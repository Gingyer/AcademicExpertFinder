// [M0 凍結] 旧「履歴画面(/history)」は project/legacy/frontend/app/history/ に退避済み。
// 履歴機能は新UIではサイドバー(M2)へ統合するため、旧URLは新メイン画面(/)へリダイレクトする。
import { redirect } from "next/navigation";

export default function LegacyHistoryRedirect() {
  redirect("/");
}
