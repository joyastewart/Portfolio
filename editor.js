(() => {
  if (!new URLSearchParams(location.search).has("edit")) return;
  const page = location.pathname.split("/").pop() || "index.html";
  const prefix = "joya-portfolio-draft-v1/";
  const bar = document.createElement("div");
  bar.className = "editbar";
  bar.innerHTML = '<b>Portfolio editor</b><select aria-label="Choose page"></select><button class="toggle">Preview draft</button><button class="download">Download edits</button><a href="">Exit</a><span role="status">Click text to type or a photo to replace it.</span>';
  const pages = {"index.html":"Homepage","hydra.html":"Hydra","respooler.html":"Respooler","sing-buddy.html":"Sing Buddy","sing-buddy-code.html":"Sing Buddy code","blokus.html":"Blokus"};
  const select = bar.querySelector("select");
  for (const [path, name] of Object.entries(pages)) select.add(new Option(name,path,false,path.replace(/\.html$/, "") === page.replace(/\.html$/, "")));
  select.onchange = () => location.assign(select.value + "?edit=1");
  bar.querySelector("a").href = page;
  const message = text => { bar.querySelector('[role="status"]').textContent = text; };
  let editing = true;
  const targets = [...document.querySelectorAll("header a, main h1, main h2, main h3, main li[data-edit-slot], main small, main p, main figcaption, main strong, main .degree, main a:not(.card), footer h2, footer small, footer a, footer .footline span, img")].filter(el => !el.parentElement.closest("h1,h2,h3,p,figcaption,a:not(.card)"));
  const picker = document.createElement("input");
  picker.type = "file"; picker.accept = "image/jpeg,image/png,image/webp"; picker.hidden = true;
  let selectedImage;
  function persist(el, value) {
    try {
      localStorage.setItem(prefix + el.dataset.editId, JSON.stringify(value));
      message("Draft saved in this browser.");
      return true;
    } catch { message("Browser storage is full or unavailable. Download existing edits and try a smaller image."); return false; }
  }
  // Preserve the portfolio's inline typography while storing only text and formatting.
  function clean(el) {
    const root = document.createElement("div");
    function copy(source, dest) {
      for (const node of source.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) dest.append(node.textContent);
        else if (["I","B","STRONG","EM","SPAN","BR","DIV"].includes(node.nodeName)) {
          const child = document.createElement(node.nodeName.toLowerCase());
          dest.append(child); copy(node, child);
        } else if (node.nodeType === Node.ELEMENT_NODE) copy(node, dest);
      }
    }
    copy(el,root); return root.innerHTML;
  }
  targets.forEach((el,i) => {
    const id = el.dataset.sharedEdit ? "shared/" + el.dataset.sharedEdit : page + "/" + (el.dataset.editSlot ?? i);
    el.dataset.editId = id;
    try {
      const value = JSON.parse(localStorage.getItem(prefix+id));
      if (value && value.tag === el.tagName) {
        if (el.tagName === "IMG" && /^data:image\/webp;base64,/.test(value.image)) el.src = value.image;
        else if (typeof value.html === "string" && el.tagName !== "IMG") {
          const parsed = new DOMParser().parseFromString(value.html,"text/html");
          el.innerHTML = clean(parsed.body);
        }
      }
    } catch { message("This browser could not load the saved draft."); }
    if (el.tagName === "IMG") {
      el.onclick = e => { if (editing) { e.preventDefault(); selectedImage = el; picker.click(); } };
      el.onkeydown = e => { if (editing && ["Enter"," "].includes(e.key)) { e.preventDefault(); el.click(); } };
    } else {
      el.addEventListener("input",() => persist(el,{tag:el.tagName,html:clean(el),text:el.innerText}));
    }
  });
  const snippets = document.querySelectorAll(".codebook pre > code");
  snippets.forEach((code, index) => {
    const pre = code.parentElement;
    const field = document.createElement("textarea");
    const title = pre.closest("details").querySelector("summary strong");
    field.className = "snippet-editor";
    field.setAttribute("aria-label", "Edit code: " + title.textContent);
    field.spellcheck = false;
    field.wrap = "off";
    field.dataset.editId = "sing-buddy-code.html/code-" + (index + 1);
    try {
      const saved = JSON.parse(localStorage.getItem(prefix + field.dataset.editId));
      if (saved?.tag === "CODE" && typeof saved.text === "string") code.textContent = saved.text;
    } catch { message("Could not load the code draft."); }
    field.value = code.textContent;
    field.rows = Math.max(4, Math.min(22, field.value.split("\n").length));
    field.addEventListener("input", () => {
      code.textContent = field.value;
      persist(field, {tag:"CODE", text:field.value});
    });
    pre.after(field);
  });
  if (snippets.length) {
    snippets[0].closest("details").open = true;
    message("Open a section to edit its label, explanation, or Python code.");
    for (const label of document.querySelectorAll(".codebook summary strong")) {
      label.addEventListener("click", event => { if (editing) event.preventDefault(); });
    }
  }
  picker.onchange = async () => {
    const file = picker.files[0], target = selectedImage;
    if (!file || !target) return;
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      const scale = Math.min(1,1400 / Math.max(img.width,img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1,Math.round(img.width*scale)); canvas.height = Math.max(1,Math.round(img.height*scale));
      canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
      const image = canvas.toDataURL("image/webp",0.87);
      if (persist(target,{tag:"IMG",image,original:target.getAttribute("data-original")})) target.src = image;
    } catch { message("Could not read that photo. Try a JPG, PNG, or WebP."); }
    finally { URL.revokeObjectURL(url); picker.value = ""; }
  };
  document.addEventListener("click",e => {
    const link = e.target.closest("a");
    if (!link || bar.contains(link)) return;
    if (editing) e.preventDefault();
    else if (link.origin === location.origin && /\.html$/.test(link.pathname)) { const dest = new URL(link.href); dest.searchParams.set("edit","1"); link.href=dest.href; }
  });
  function mode() {
    document.body.classList.toggle("editing",editing);
    targets.forEach(el => {
      if (el.tagName === "IMG") { el.tabIndex=editing?0:-1; }
      else if (editing) el.setAttribute("contenteditable","plaintext-only");
      else el.removeAttribute("contenteditable");
    });
    bar.querySelector(".toggle").textContent = editing ? "Preview draft" : "Resume editing";
  }
  bar.querySelector(".toggle").onclick = () => { editing = !editing; mode(); message(editing?"Click text or a photo.":"Viewing your browser draft."); };
  bar.querySelector(".download").onclick = () => {
    try {
      const edits = {};
      for (const key of Object.keys(localStorage)) if (key.startsWith(prefix)) edits[key.slice(prefix.length)] = JSON.parse(localStorage.getItem(key));
      const blob = new Blob([JSON.stringify({format:"joya-portfolio-draft-v1",edits},null,2)],{type:"application/json"});
      const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="Joya-portfolio-edits.json"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
      message("Downloaded edits from all pages. Upload this file in your portfolio chat to publish.");
    } catch { message("Could not download the draft in this browser."); }
  };
  document.body.prepend(bar,picker); mode();
})();
