import test from "node:test";
import assert from "node:assert/strict";
import { classify, validateRules } from "../extension/classifier.js";
import { DEFAULT_RULES } from "../extension/rules.js";
const v = (title, description = "", channel = "Example", transcript = "") => ({
  id: "abcdefghijk",
  channelId: "UCexample",
  title,
  description,
  channel,
  transcript,
});
test("unknown, vague study keywords and English entertainment fail closed", () => {
  for (const x of [
    v(""),
    v("学习 研究 很重要", "我的日常生活"),
    v("My English day", "Travel with me"),
    v("Python", ""),
  ])
    assert.equal(classify(x, DEFAULT_RULES).allow, false);
});
test("combines subject and instructional evidence across fields", () => {
  for (const x of [
    v(
      "Linear algebra lecture 4",
      "Eigenvalues and eigenvectors, exercises and proofs",
    ),
    v(
      "Python tutorial: functions",
      "Learn to program with examples and exercises",
    ),
    v(
      "Lecture 1: Machine Learning",
      "University course on supervised learning and gradient descent",
    ),
    v(
      "English pronunciation lesson",
      "Practice vocabulary and grammar with these exercises",
    ),
    v("深度学习课程：反向传播", "本节课讲解神经网络梯度推导与练习"),
  ])
    assert.equal(classify(x, DEFAULT_RULES).allow, true, x.title);
});
test("music and entertainment deny despite study and technical words", () => {
  for (const x of [
    v("Study music for programming", "Python tutorial course"),
    v("学习音乐 专注背景音乐", "数学课程"),
    v("Official music video English lesson", "grammar vocabulary"),
    v("Minecraft gameplay AI tutorial", "machine learning exercises"),
    v("Anime edit math lesson", "linear algebra proof"),
  ])
    assert.equal(classify(x, DEFAULT_RULES).allow, false, x.title);
});
test("incidental music credit in academic description is not title entertainment", () => {
  assert.equal(
    classify(
      v(
        "Calculus lecture: derivatives",
        "University mathematics course with exercises. Music credits: example.",
      ),
      DEFAULT_RULES,
    ).allow,
    true,
  );
});
test("explicit deny wins over video/channel allow", () => {
  let r = structuredClone(DEFAULT_RULES);
  r.allowVideoIds = ["abcdefghijk"];
  r.denyChannelIds = ["UCexample"];
  assert.equal(
    classify(v("Python tutorial", "programming exercises"), r).allow,
    false,
  );
  r.denyChannelIds = [];
  r.denyVideoIds = ["abcdefghijk"];
  assert.equal(classify(v("Lecture"), r).allow, false);
  r.denyVideoIds = [];
  r.denyPatterns = ["blocked"];
  assert.equal(classify(v("blocked"), r).allow, false);
});
test("explicit allow and available transcript evidence", () => {
  let r = structuredClone(DEFAULT_RULES);
  r.allowVideoIds = ["abcdefghijk"];
  assert.equal(classify(v("Special lecture"), r).allow, true);
  assert.equal(
    classify(
      v(
        "Calculus lecture",
        "",
        "Professor",
        "Today we prove the derivative theorem and solve exercises",
      ),
      DEFAULT_RULES,
    ).allow,
    true,
  );
});
test("paper explanation uses subject evidence in description rather than requiring the title to name a subject", () => {
  assert.equal(
    classify(
      v(
        "Attention Is All You Need — Paper Explained",
        "A lecture explaining transformer neural networks and machine learning research.",
      ),
      DEFAULT_RULES,
    ).allow,
    true,
  );
});
test("a numbered mathematics chapter with supporting description counts as instruction", () => {
  assert.equal(
    classify(
      v(
        "Vectors | Chapter 1, Essence of linear algebra",
        "A geometric introduction to vectors and linear algebra.",
      ),
      DEFAULT_RULES,
    ).allow,
    true,
  );
});
test("malformed rules rejected; invalid metadata fails closed", () => {
  assert.throws(() => validateRules({ ...DEFAULT_RULES, denyPatterns: ["["] }));
  assert.equal(classify(null, DEFAULT_RULES).allow, false);
});
