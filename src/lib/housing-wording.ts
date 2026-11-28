export function formatHousingWording(text: string): string {
  return text.replace(/\b(?:bất[ \t]+động[ \t]+sản|bđs)\b/giu, (term) =>
    term[0] === "B" ? "Nhà cho thuê" : "nhà cho thuê",
  );
}
