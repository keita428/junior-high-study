"use strict";
const panel = document.querySelector("#panel");
const unitSelect = document.querySelector("#unit");
const tabs = [...document.querySelectorAll("[data-mode]")];
const storageNote = document.querySelector("#storage-note");
const storageKey = "junior-high-music-v1";
const validIds = new Set(questions.map(question => question.id));

let history = {missed: [], answered: 0, correct: 0};
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
  if (saved && Array.isArray(saved.missed)) {
    history = {
      missed: [...new Set(saved.missed.filter(id => validIds.has(id)))],
      answered: Number.isSafeInteger(saved.answered) ? saved.answered : 0,
      correct: Number.isSafeInteger(saved.correct) ? saved.correct : 0
    };
  }
  save();
} catch {
  storageNote.hidden = false;
}

let mode = "summary";
let queue = [];
let position = 0;
let score = 0;
let missedThisTime = [];

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(history));
  } catch {
    storageNote.hidden = false;
  }
}

function node(tag, text, parent = panel) {
  const element = document.createElement(tag);
  element.textContent = text;
  parent.append(element);
  return element;
}

function button(text, action, parent = panel, className = "") {
  const element = node("button", text, parent);
  element.type = "button";
  element.className = className;
  element.addEventListener("click", action);
  return element;
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function normalize(answer) {
  return answer.normalize("NFKC").toLowerCase().replace(/[\s・、。]/g, "")
    .replace(/[ァ-ヶ]/g, letter => String.fromCharCode(letter.charCodeAt(0) - 96));
}

function start(nextMode, ids) {
  mode = nextMode;
  position = 0;
  score = 0;
  missedThisTime = [];
  queue = questions.filter(question => {
    if (unitSelect.value !== "all" && String(question.unit) !== unitSelect.value) return false;
    if (mode === "review") return (ids || history.missed).includes(question.id);
    if (mode === "instrument") return instrumentIds.includes(question.id);
    return true;
  });
  if (mode === "choice") queue = shuffle(queue);
  tabs.forEach(tab => tab.setAttribute("aria-pressed", String(tab.dataset.mode === mode)));
  render();
}

function heading(text, focus) {
  const title = node("h2", text);
  title.tabIndex = -1;
  if (focus) title.focus();
  return title;
}

function render(focus = false) {
  panel.replaceChildren();
  if (mode === "summary") {
    heading("単元別まとめ", focus);
    node("p", "学習記録　正解 " + history.correct + " / 解答 " + history.answered + "　要復習 " + history.missed.length + " 問").className = "meta";
    units.forEach(([title, pages], index) => {
      if (unitSelect.value !== "all" && unitSelect.value !== String(index)) return;
      node("h3", title);
      node("p", pages).className = "meta";
      node("p", summaries[index]);
    });
    node("p", "写真で確認した教科書は40・41ページです。雅楽と能は鑑賞プリントを中心に出題し、51ページの唱歌は補足問題を収録しています。").className = "note";
    return;
  }

  const question = queue[position];
  if (!question) {
    if (!queue.length) {
      heading(mode === "review" ? "この範囲に誤答はありません" : "この範囲に楽器の問題はありません", focus);
      return;
    }
    const isCard = mode === "cards";
    heading(isCard ? "暗記カード終了" : "採点結果", focus);
    node("p", isCard ? queue.length + "枚を確認しました。" : score + " / " + queue.length + " 問正解");
    const actions = node("div", "");
    actions.className = "actions";
    button("もう一度", () => start(mode), actions);
    if (missedThisTime.length) {
      button("今回の誤答だけ復習", () => start("review", missedThisTime), actions, "primary");
    }
    return;
  }

  node("p", units[question.unit][0] + "　" + (position + 1) + " / " + queue.length).className = "meta";
  const progress = node("progress", "");
  progress.max = queue.length;
  progress.value = position;
  progress.setAttribute("aria-label", "完了した問題数");
  const prompt = ["fill", "cards"].includes(mode) ? question.prompt : question.prompt.replace("＿＿", "［？］");
  heading(prompt, focus);

  if (mode === "cards") {
    const reveal = button("赤シートをめくる", () => {
      answer.hidden = !answer.hidden;
      reveal.setAttribute("aria-expanded", String(!answer.hidden));
      reveal.textContent = answer.hidden ? "赤シートをめくる" : "答えを隠す";
    }, panel, "red-sheet");
    reveal.setAttribute("aria-controls", "card-answer");
    reveal.setAttribute("aria-expanded", "false");
    const answer = node("div", "");
    answer.id = "card-answer";
    answer.hidden = true;
    node("p", question.answer, answer).className = "card-answer";
    node("p", question.note, answer);
    navigation(true);
    return;
  }

  const form = node("form", "");
  const feedback = node("div", "");
  feedback.className = "feedback";
  feedback.setAttribute("aria-live", "polite");
  let graded = false;
  function grade(value) {
    if (graded) return;
    graded = true;
    const correct = value !== null && [question.answer, ...question.aliases].some(answer => normalize(answer) === normalize(value));
    history.answered++;
    if (correct) {
      score++;
      history.correct++;
      history.missed = history.missed.filter(id => id !== question.id);
    } else {
      missedThisTime.push(question.id);
      if (!history.missed.includes(question.id)) history.missed.push(question.id);
    }
    save();
    form.querySelectorAll("button, input").forEach(control => { control.disabled = true; });
    feedback.classList.add(correct ? "correct" : "incorrect");
    node("p", correct ? "正解！" : value === null ? "未解答" : "不正解", feedback);
    node("p", "答え　" + question.answer, feedback);
    if (value !== null && !correct) node("p", "あなたの答え　" + value, feedback);
    node("p", question.note, feedback);
    navigation(false);
  }

  if (["choice", "instrument", "review"].includes(mode)) {
    for (const choice of shuffle([question.answer, ...question.choices])) {
      button(choice, () => grade(choice), form, "option");
    }
  } else {
    const label = node("label", "答えを入力", form);
    label.htmlFor = "response";
    const input = node("input", "", form);
    input.id = "response";
    input.autocomplete = "off";
    input.maxLength = 100;
    input.required = true;
    const submit = node("button", "採点する", form);
    submit.type = "submit";
    submit.className = "primary";
    form.addEventListener("submit", event => {
      event.preventDefault();
      if (normalize(input.value)) grade(input.value.trim());
    });
    button("答えを見る", () => grade(null), form);
  }
}

function navigation(cards) {
  const actions = node("div", "");
  actions.className = "actions";
  if (cards && position > 0) button("前へ", () => { position--; render(true); }, actions);
  const label = position + 1 < queue.length ? "次へ" : cards ? "終了" : "結果を見る";
  button(label, () => { position++; render(true); }, actions, "primary");
}

units.forEach(([title, pages], index) => {
  node("option", title + "（" + pages + "）", unitSelect).value = String(index);
});
unitSelect.addEventListener("change", () => start(mode));
tabs.forEach(tab => tab.addEventListener("click", () => start(tab.dataset.mode)));
document.querySelector("#reset").addEventListener("click", () => {
  if (!window.confirm("学習記録と誤答を消去しますか？")) return;
  history = {missed: [], answered: 0, correct: 0};
  save();
  start("summary");
});
start("summary");
