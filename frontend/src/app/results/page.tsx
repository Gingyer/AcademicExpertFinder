// [M0 凍結] 旧「結果画面(/results)」は project/legacy/frontend/app/results/ に退避済み。
// 旧URLへ到達した場合は新メイン画面(/)へリダイレクトして到達不能化する。
import { redirect } from "next/navigation";

export default function LegacyResultsRedirect() {
  redirect("/");
}
