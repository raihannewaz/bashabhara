import { Languages } from "lucide-react";
import { setLang } from "@/actions/lang";
import { getLang } from "@/lib/i18n";

export default async function LangToggle() {
  const lang = await getLang();
  return (
    <form action={setLang}>
      <input type="hidden" name="lang" value={lang === "bn" ? "en" : "bn"} />
      <button type="submit" className="flex w-full items-center justify-center gap-2" style={{ background: "transparent", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--input))", padding: "6px 12px" }}>
        <Languages className="h-4 w-4" />{lang === "bn" ? "English" : "বাংলা"}
      </button>
    </form>
  );
}
