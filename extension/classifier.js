const fields = [
  "allowVideoIds",
  "denyVideoIds",
  "allowChannelIds",
  "denyChannelIds",
  "denyPatterns",
  "entertainmentPatterns",
  "subjectPatterns",
  "instructionPatterns",
  "languageInstructionPatterns",
];

export function validateRules(r) {
  if (!r || r.version !== 1) throw Error("Rules version must be 1");
  for (const f of fields) {
    if (
      !Array.isArray(r[f]) ||
      r[f].length > 300 ||
      r[f].some((x) => typeof x !== "string" || x.length > 2000)
    )
      throw Error("Invalid rule field: " + f);
    if (f.endsWith("Patterns")) for (const p of r[f]) new RegExp(p, "iu");
  }
  return r;
}
export function classify(m, r) {
  const result = (allow, reason) => ({ allow, reason });
  try {
    validateRules(r);
    if (!m || !/^[\w-]{11}$/.test(m.id || ""))
      return result(false, "No reliable video ID");
    const title = String(m.title || "").slice(0, 1000),
      channel = String(m.channel || "").slice(0, 500);
    const description = String(m.description || "").slice(0, 16000),
      transcript = String(m.transcript || "").slice(0, 24000);
    const matches = (f, s) => r[f].some((p) => new RegExp(p, "iu").test(s));
    if (r.denyVideoIds.includes(m.id) || r.denyChannelIds.includes(m.channelId))
      return result(false, "Explicit block list match");
    if (
      matches(
        "denyPatterns",
        [title, channel, description, transcript].join("\n"),
      )
    )
      return result(false, "Explicit block pattern match");
    if (
      r.allowVideoIds.includes(m.id) ||
      r.allowChannelIds.includes(m.channelId)
    )
      return result(true, "Explicit allow list match (blocks take priority)");
    if (!title.trim() || !channel.trim())
      return result(false, "Title or channel information is incomplete");
    if (
      matches("entertainmentPatterns", title + "\n" + channel) ||
      /^(Music|Gaming|Entertainment)$/i.test(m.category || "")
    )
      return result(false, "Music or entertainment content");
    const support = [description, transcript, channel]
      .filter(Boolean)
      .join("\n");
    const titleSubject = matches("subjectPatterns", title),
      titleInstruction = matches("instructionPatterns", title);
    const supportSubject = matches("subjectPatterns", support),
      supportInstruction = matches("instructionPatterns", support);
    const languageOnly =
      /\b(english|ielts|toefl|esl|pronunciation|grammar|vocabulary)\b|英语|英語/iu.test(
        title,
      ) &&
      !matches(
        "subjectPatterns",
        title.replace(
          /\b(english|ielts|toefl|esl|pronunciation|grammar|vocabulary)\b|英语|英語/giu,
          "",
        ),
      );
    if (languageOnly && !matches("languageInstructionPatterns", title))
      return result(
        false,
        "English content is not necessarily language instruction",
      );
    if (
      (titleSubject &&
        (titleInstruction || supportInstruction) &&
        (supportSubject || supportInstruction)) ||
      (titleInstruction && supportSubject && supportInstruction)
    )
      return result(
        true,
        transcript
          ? "Subject and teaching evidence match, including available captions"
          : "Title and channel/description support instructional content",
      );
    return result(false, "Insufficient teaching evidence; muted");
  } catch {
    return result(false, "Classification or rules failed; muted");
  }
}
