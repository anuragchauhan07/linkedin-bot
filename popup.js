document.getElementById("btn").addEventListener("click", async () => {
  const replyText = document.getElementById("reply").value.trim();
  if (!replyText) {
    document.getElementById("status").textContent = "Please enter a reply message.";
    return;
  }

  const btn = document.getElementById("btn");
  const status = document.getElementById("status");
  btn.disabled = true;
  status.textContent = "Running...";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: replyToAllComments,
    args: [replyText],
  });

  const msg = result?.[0]?.result || "Done.";
  status.textContent = msg;
  btn.disabled = false;
});

function replyToAllComments(replyText) {
  return new Promise(async (resolve) => {

    function sleep(ms) {
      return new Promise(r => setTimeout(r, ms));
    }

    function randomDelay() {
      return Math.floor(Math.random() * 1000) + 3000; // 1-2 seconds
    } 

    // Scroll to load all comments first
    async function loadAllComments() {
      let unchanged = 0, lastHeight = 0;
      while (unchanged < 4) {
        // Click "Load more comments" buttons
        document.querySelectorAll("button").forEach(b => {
          if (/load more comments/i.test(b.innerText)) b.click();
        });
        window.scrollBy(0, 1500);
        await sleep(1200);
        const h = document.body.scrollHeight;
        if (h === lastHeight) unchanged++; else { unchanged = 0; lastHeight = h; }
      }
    }

    await loadAllComments();

    // KEY FIX: Only select top-level comment articles.
    // Top-level = has class "comments-comment-entity" but NOT "comments-comment-entity--reply"
    const topLevelArticles = document.querySelectorAll(
      "article.comments-comment-entity:not(.comments-comment-entity--reply)"
    );

    if (topLevelArticles.length === 0) {
      return resolve("No top-level comments found. Make sure you're on a LinkedIn post.");
    }

    let count = 0;

    for (const article of topLevelArticles) {
      // Find the Reply button inside this specific top-level comment article
      const replyBtn = [...article.querySelectorAll("button")].find(
        b => b.innerText.trim().toLowerCase() === "reply"
      );
      if (!replyBtn) continue;

      replyBtn.scrollIntoView({ behavior: "smooth", block: "center" });
      await sleep(600);
      replyBtn.click();
      await sleep(1500);

      // Find the editor that appeared inside this article
      let editor = article.querySelector("div.ql-editor[contenteditable='true']");
      if (!editor) {
        // Fallback: last editor on page
        const all = document.querySelectorAll("div.ql-editor[contenteditable='true']");
        editor = all[all.length - 1];
      }
      if (!editor) continue;

      editor.focus();
      document.execCommand("insertText", false, replyText);
      await sleep(600);

      // Find the Reply submit button — walk up from editor,
      // find a "Reply" button that is NOT the original trigger
      let submitBtn = null;
      let parent = editor.parentElement;
      for (let i = 0; i < 10; i++) {
        if (!parent) break;
        const candidates = [...parent.querySelectorAll("button")].filter(b =>
          b !== replyBtn &&
          b.offsetParent !== null &&
          !b.disabled &&
          b.innerText.trim().toLowerCase() === "reply"
        );
        if (candidates.length > 0) { submitBtn = candidates[0]; break; }
        parent = parent.parentElement;
      }

      if (submitBtn) {
        submitBtn.click();
      } else {
        editor.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Enter", keyCode: 13, ctrlKey: true, bubbles: true
        }));
      }

      count++;
      await sleep(randomDelay());
    }

    resolve(`Done! Replied to ${count} top-level comment(s).`);
  });
}