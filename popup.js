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
      return Math.floor(Math.random() * 10000) + 5000;
    }

    // Snapshot all "Reply" trigger buttons BEFORE we start.
    // Once a reply box opens, a new blue "Reply" submit button appears inside it —
    // we snapshot now so we only loop over the comment reply triggers, not the submit buttons.
    const replyTriggers = [...document.querySelectorAll("button")].filter(
      b => b.innerText.trim().toLowerCase() === "reply"
    );

    if (replyTriggers.length === 0) {
      return resolve("No comments found. Make sure you're on a LinkedIn post.");
    }

    let count = 0;

    for (const replyBtn of replyTriggers) {
      // Scroll to and click the "Reply" link under the comment
      replyBtn.scrollIntoView({ behavior: "smooth", block: "center" });
      await sleep(800);
      replyBtn.click();
      await sleep(1500); // wait for the reply box to fully open

      // Find the editor that just appeared
      let editor = null;
      const container = replyBtn.closest("article, li, div.comments-comment-item");
      if (container) {
        editor = container.querySelector("div.ql-editor[contenteditable='true']");
      }
      if (!editor) {
        const all = document.querySelectorAll("div.ql-editor[contenteditable='true']");
        editor = all[all.length - 1];
      }
      if (!editor) continue;

      // Type the reply text
      editor.focus();
      document.execCommand("insertText", false, replyText);
      await sleep(800);

      // Find the blue "Reply" submit button that appeared INSIDE the reply box.
      // It's a different button from the trigger — it only exists after the box opens.
      // Walk up from the editor to find it.
      let submitBtn = null;
      let parent = editor.parentElement;
      for (let i = 0; i < 10; i++) {
        if (!parent) break;
        const candidates = [...parent.querySelectorAll("button")].filter(b => {
          return b !== replyBtn &&              // not the original trigger
                 b.offsetParent !== null &&     // visible
                 !b.disabled &&                 // enabled (has text in it)
                 b.innerText.trim().toLowerCase() === "reply";
        });
        if (candidates.length > 0) {
          submitBtn = candidates[0];
          break;
        }
        parent = parent.parentElement;
      }

      if (submitBtn) {
        submitBtn.click();
      } else {
        // Fallback: Ctrl+Enter
        editor.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Enter", keyCode: 13, ctrlKey: true, bubbles: true
        }));
      }

      count++;
      await sleep(randomDelay());
    }

    resolve(`Done! Replied to ${count} comment(s).`);
  });
}