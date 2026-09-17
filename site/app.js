const app = document.querySelector("#app");
const search = document.querySelector("#search");
const navButtons = [...document.querySelectorAll("[data-view]")];

let data;
let view = "home";
let query = "";
let bookFilter = "全部";
let selectedNotebook = null;
let noteFilter = "全部";

const esc = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));
const cover = (book, className = "cover") => book.cover
  ? `<img class="${className}" src="${esc(book.cover)}" alt="${esc(book.title)}封面" loading="lazy">`
  : `<div class="${className}" aria-label="${esc(book.title)}">${esc(book.title)}</div>`;

function setView(next) {
  view = next;
  selectedNotebook = null;
  query = "";
  search.value = "";
  render();
  window.scrollTo({ top: next === "home" ? 0 : 70, behavior: "smooth" });
}

function renderHero() {
  const current = data.currentBook;
  return `<section class="hero">
    <div class="hero-copy">
      <p class="eyebrow">我的微信读书 · 公开书房</p>
      <h1>在文字里，<br><em>慢慢成为自己。</em></h1>
      <p>这里收着我读过的书、划过的线，<br>以及那些曾让我停下来想一想的句子。</p>
      <span class="sync">更新于 ${data.generatedAt ? new Date(data.generatedAt).toLocaleString("zh-CN") : "等待首次同步"}</span>
    </div>
    <article class="current">
      <small>CURRENTLY READING</small>
      ${current ? `<div class="current-grid">${cover(current)}<div><p>最近在读</p><h2>${esc(current.title)}</h2><span>${esc(current.author)}</span><div class="bar"><i style="width:${current.progress}%"></i></div><small>已读 ${current.progress}% · ${esc(current.readingTime)}</small></div></div>` : `<p>首次 GitHub Actions 同步后，这里会显示最近阅读。</p>`}
    </article>
  </section>
  <section class="stats">
    <div><b>${esc(data.stats.finished)}</b><span>累计已读完</span></div>
    <div><b>${data.stats.shelf}</b><span>公开书架</span></div>
    <div><b>${esc(data.stats.totalTime)}</b><span>阅读时长</span></div>
    <div><b>${data.stats.noteCount}</b><span>笔记</span></div>
  </section>`;
}

function renderShelf() {
  const books = data.books.filter((book) =>
    (bookFilter === "全部" || book.status === bookFilter) &&
    `${book.title}${book.author}`.toLowerCase().includes(query.toLowerCase()));
  const counts = {
    "全部": data.books.length,
    "在读": data.books.filter((book) => book.status === "在读").length,
    "读完": data.books.filter((book) => book.status === "读完").length,
    "想读": data.books.filter((book) => book.status === "想读").length,
  };
  return `<section class="section">
    <header class="section-head"><div><h2>我的书架</h2><p>展示 ${data.stats.publicBooks} 本公开电子书，其中 ${data.stats.publicFinished} 本已标记读完。</p></div>
      <div class="filters">${["全部","在读","读完","想读"].map((item) => `<button data-book-filter="${item}" class="${bookFilter === item ? "active" : ""}">${item}<span>${counts[item]}</span></button>`).join("")}</div>
    </header>
    <div class="book-grid">${books.map((book) => `<article class="book">${cover(book)}<h3>${esc(book.title)}</h3><p>${esc(book.author)}</p><div class="bar"><i style="width:${book.progress}%"></i></div><small>${book.status === "读完" ? "读完了" : book.progress > 0 ? `${book.progress}%` : book.status === "在读" ? "已开始" : "在书架"}</small></article>`).join("")}</div>
    ${books.length ? "" : `<p class="empty">公开书架里没有找到符合条件的书。</p>`}
  </section>`;
}

function renderNotebookIndex() {
  const notebooks = data.notebookBooks.filter((book) => `${book.title}${book.author}`.toLowerCase().includes(query.toLowerCase()));
  return `<section class="section">
    <header class="section-head"><div><h2>我的笔记</h2><p>${data.stats.noteBooks} 本公开书籍，共 ${data.stats.noteCount} 条笔记。</p></div></header>
    <div class="notebook-grid">${notebooks.map((book) => `<button class="notebook" data-notebook="${esc(book.id)}">${cover(book, "")}<div><h3>${esc(book.title)}</h3><p>${esc(book.author)}</p><div class="counts"><span>${book.counts.highlights} 划线</span><span>${book.counts.thoughts} 想法</span><span>${book.counts.bookmarks} 书签</span></div><small>查看 ${book.counts.total} 条笔记 →</small></div></button>`).join("")}</div>
    ${notebooks.length ? "" : `<p class="empty">没有找到匹配的笔记书目。</p>`}
  </section>`;
}

function renderNotebookDetail() {
  const book = selectedNotebook;
  const notes = book.notes.filter((note) =>
    (noteFilter === "全部" || note.type === noteFilter) &&
    `${note.chapter}${note.quote}${note.thought}`.toLowerCase().includes(query.toLowerCase()));
  return `<section class="section">
    <button class="back" id="back">← 返回笔记书目</button>
    <header class="section-head"><div><h2>${esc(book.title)}</h2><p>${esc(book.author)} · 共 ${book.counts.total} 条笔记</p></div>
      <div class="filters">${["全部","划线","想法"].map((item) => `<button data-note-filter="${item}" class="${noteFilter === item ? "active" : ""}">${item}</button>`).join("")}</div>
    </header>
    <aside class="summary">${cover(book, "")}<div><h3>${esc(book.title)}</h3><span>${esc(book.author)}</span><div class="summary-counts"><b>${book.counts.highlights}<small>划线</small></b><b>${book.counts.thoughts}<small>想法</small></b><b>${book.counts.bookmarks}<small>书签</small></b></div><span>书签仅统计数量，当前不能导出内容。</span></div></aside>
    <div class="notes">${notes.map((note) => `<article class="note ${note.type === "想法" ? "thought" : ""}"><div class="meta"><b>${note.type}</b><span>${esc(note.chapter)}</span><time>${esc(note.date)}</time></div>${note.quote ? `<blockquote>${esc(note.quote)}</blockquote>` : ""}${note.thought ? `<p>${esc(note.thought)}</p>` : ""}</article>`).join("")}</div>
    ${notes.length ? "" : `<p class="empty">没有匹配的笔记内容。</p>`}
  </section>`;
}

function renderAbout() {
  return `<section class="section"><div class="about"><h2>关于阅迹</h2><p>这是一个由 GitHub Actions 定时同步的微信读书个人主页，记录公开书架、阅读进度、划线与想法。</p><div class="privacy">已自动排除 ${data.stats.privateItemsExcluded} 个私密条目。微信读书 API Key 保存在 GitHub Secret 中，不会进入网页源码。</div></div></section>`;
}

function render() {
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  search.placeholder = view === "notes" ? selectedNotebook ? "搜索本书笔记" : "搜索有笔记的书" : "搜索我的阅读";
  if (view === "home") app.innerHTML = renderHero() + renderShelf();
  if (view === "shelf") app.innerHTML = renderShelf();
  if (view === "notes") app.innerHTML = selectedNotebook ? renderNotebookDetail() : renderNotebookIndex();
  if (view === "about") app.innerHTML = renderAbout();
}

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) return setView(viewButton.dataset.view);
  const bookButton = event.target.closest("[data-book-filter]");
  if (bookButton) { bookFilter = bookButton.dataset.bookFilter; return render(); }
  const noteButton = event.target.closest("[data-note-filter]");
  if (noteButton) { noteFilter = noteButton.dataset.noteFilter; return render(); }
  const notebookButton = event.target.closest("[data-notebook]");
  if (notebookButton) {
    selectedNotebook = data.notebookBooks.find((book) => book.id === notebookButton.dataset.notebook);
    noteFilter = "全部"; query = ""; search.value = ""; return render();
  }
  if (event.target.closest("#back")) { selectedNotebook = null; query = ""; search.value = ""; render(); }
});

search.addEventListener("input", (event) => { query = event.target.value; render(); });

fetch("./data.json")
  .then((response) => response.ok ? response.json() : Promise.reject(new Error("数据文件加载失败")))
  .then((result) => { data = result; render(); })
  .catch((error) => { app.innerHTML = `<section class="loading"><p>${esc(error.message)}，请在 GitHub Actions 中运行首次同步。</p></section>`; });
