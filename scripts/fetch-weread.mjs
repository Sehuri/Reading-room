import { writeFile } from "node:fs/promises";

const ENDPOINT = "https://i.weread.qq.com/api/agent/gateway";
const VERSION = "1.0.4";
const key = process.env.WEREAD_API_KEY;

if (!key) throw new Error("缺少 GitHub Secret：WEREAD_API_KEY");

async function weread(api_name, params = {}) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ api_name, ...params, skill_version: VERSION }),
  });
  const data = await response.json();
  if (data.upgrade_info) throw new Error(data.upgrade_info.message || "微信读书 Skill 需要升级");
  if (!response.ok || (data.errcode && data.errcode !== 0)) {
    throw new Error(data.errmsg || `微信读书请求失败：${response.status}`);
  }
  return data;
}

const clean = (value = "") => value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const date = (value) => value ? new Intl.DateTimeFormat("zh-CN", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Shanghai",
}).format(new Date(value * 1000)).replaceAll("/", "-") : "";
const duration = (seconds = 0) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h ? `${h}小时${m ? `${m}分钟` : ""}` : `${m}分钟`;
};
const stat = (items = [], name) => items.find((item) => item.stat === name)?.counts || "—";

async function allNotebooks() {
  const books = [];
  let lastSort;
  let totalBookCount = 0;
  let totalNoteCount = 0;
  for (let page = 0; page < 20; page += 1) {
    const result = await weread("/user/notebooks", {
      count: 100,
      ...(lastSort ? { lastSort } : {}),
    });
    if (page === 0) {
      totalBookCount = result.totalBookCount || 0;
      totalNoteCount = result.totalNoteCount || 0;
    }
    books.push(...(result.books || []));
    if (result.hasMore !== 1 || !result.books?.length) break;
    lastSort = result.books.at(-1).sort;
  }
  return { books, totalBookCount, totalNoteCount };
}

async function allReviews(bookId) {
  const reviews = [];
  let synckey = 0;
  for (let page = 0; page < 50; page += 1) {
    const result = await weread("/review/list/mine", {
      bookid: bookId,
      count: 100,
      ...(synckey ? { synckey } : {}),
    });
    reviews.push(...(result.reviews || []));
    if (result.hasMore !== 1 || !result.synckey || result.synckey === synckey) break;
    synckey = result.synckey;
  }
  return reviews;
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const [shelf, notebooks, annual, overall] = await Promise.all([
  weread("/shelf/sync"),
  allNotebooks(),
  weread("/readdata/detail", { mode: "annually", baseTime: 0 }),
  weread("/readdata/detail", { mode: "overall", baseTime: 0 }),
]);

const publicBooks = (shelf.books || [])
  .filter((book) => book.secret !== 1)
  .sort((a, b) => (b.readUpdateTime || 0) - (a.readUpdateTime || 0));
const publicMap = new Map(publicBooks.map((book) => [String(book.bookId), book]));
const finishedNotebookBooksOutsideShelf = notebooks.books
  .filter((item) => item.markedStatus === 1 && !publicMap.has(String(item.bookId)))
  .map((item) => ({
    bookId: String(item.bookId),
    title: item.book?.title || "未命名书籍",
    author: item.book?.author || "佚名",
    cover: item.book?.cover || "",
    readingProgress: Number(item.readingProgress || 0),
    markedStatus: item.markedStatus,
    sort: item.sort || 0,
  }));
const recent = publicBooks.slice(0, 5);
const progress = await Promise.allSettled(recent.map((book) => weread("/book/getprogress", { bookId: book.bookId })));
const progressMap = new Map();
progress.forEach((result, index) => {
  if (result.status === "fulfilled") progressMap.set(String(recent[index].bookId), result.value.book || {});
});

const books = publicBooks.map((book) => {
  const p = progressMap.get(String(book.bookId));
  const isFinished = book.finishReading === 1;
  const recordedProgress = Number(p?.progress ?? 0);
  const hasStarted = recordedProgress > 0 || Number(book.readUpdateTime || 0) > 0;
  return {
    id: String(book.bookId),
    title: book.title,
    author: book.author || "佚名",
    cover: book.cover || "",
    category: book.category || "阅读",
    progress: isFinished ? 100 : recordedProgress,
    status: isFinished ? "读完" : hasStarted ? "在读" : "想读",
    updatedAt: date(p?.updateTime || book.readUpdateTime),
    readingTime: duration(p?.recordReadingTime || 0),
    deepLink: book.deepLink || "",
  };
});

const publicNotebooks = notebooks.books.filter((item) => publicMap.has(String(item.bookId)));
const notebookBooks = await mapLimit(publicNotebooks, 4, async (item) => {
  const bookId = String(item.bookId);
  const shelfBook = publicMap.get(bookId);
  const [marks, reviews] = await Promise.all([
    weread("/book/bookmarklist", { bookId }),
    allReviews(bookId),
  ]);
  const chapters = new Map((marks.chapters || []).map((chapter) => [chapter.chapterUid, chapter.title]));
  const notes = [];
  const reviewRanges = new Set();
  for (const wrapper of reviews) {
    const review = wrapper.review || wrapper;
    const quote = clean(review.abstract);
    const thought = clean(review.content);
    if (!quote && !thought) continue;
    if (review.range) reviewRanges.add(String(review.range));
    notes.push({
      id: String(review.reviewId || `${bookId}-review-${notes.length}`),
      type: "想法",
      chapter: review.chapterName || chapters.get(review.chapterUid) || "读书想法",
      quote,
      thought,
      date: date(review.createTime),
      timestamp: review.createTime || 0,
    });
  }
  for (const mark of marks.updated || []) {
    if (!clean(mark.markText) || reviewRanges.has(String(mark.range))) continue;
    notes.push({
      id: String(mark.bookmarkId || `${bookId}-mark-${notes.length}`),
      type: "划线",
      chapter: chapters.get(mark.chapterUid) || "划线",
      quote: clean(mark.markText),
      thought: "",
      date: date(mark.createTime),
      timestamp: mark.createTime || 0,
    });
  }
  notes.sort((a, b) => b.timestamp - a.timestamp);
  return {
    id: bookId,
    title: item.book?.title || shelfBook.title || "未命名书籍",
    author: item.book?.author || shelfBook.author || "佚名",
    cover: item.book?.cover || shelfBook.cover || "",
    progress: Number(item.readingProgress || 0),
    updatedAt: date(item.sort),
    deepLink: shelfBook.deepLink || "",
    counts: {
      total: (item.reviewCount || 0) + (item.noteCount || 0) + (item.bookmarkCount || 0),
      thoughts: item.reviewCount || 0,
      highlights: item.noteCount || 0,
      bookmarks: item.bookmarkCount || 0,
    },
    notes,
  };
});

const publicAlbums = (shelf.albums || []).filter((album) => album.albumInfoExtra?.secret !== 1);
const publicFinished = publicBooks.filter((book) => book.finishReading === 1).length;
const currentBook = books.find((book) => book.status === "在读") || null;
const privateItemsExcluded =
  (shelf.books || []).filter((book) => book.secret === 1).length +
  (shelf.albums || []).filter((album) => album.albumInfoExtra?.secret === 1).length +
  (shelf.mp ? 1 : 0);

const output = {
  generatedAt: new Date().toISOString(),
  currentBook,
  books,
  notebookBooks,
  stats: {
    shelf: publicBooks.length + publicAlbums.length,
    publicBooks: publicBooks.length,
    publicFinished,
    read: stat(overall.readStat, "读过"),
    finished: stat(overall.readStat, "读完"),
    totalTime: duration(overall.totalReadTime),
    noteCount: notebooks.totalNoteCount,
    noteBooks: publicNotebooks.length,
    annualRead: stat(annual.readStat, "读过"),
    annualFinished: stat(annual.readStat, "读完"),
    annualDays: annual.readDays || 0,
    annualTime: duration(annual.totalReadTime),
    privateItemsExcluded,
  },
};

await writeFile(new URL("../site/data.json", import.meta.url), JSON.stringify(output));
await writeFile(new URL("../site/finished-candidates.json", import.meta.url), JSON.stringify(finishedNotebookBooksOutsideShelf));
console.log(`已生成 ${books.length} 本书、${notebookBooks.length} 本笔记书目的公开数据。`);
