const docs = [
  {
    id: "overview",
    title: "Overview",
    description: "A quick summary of the sample repository and its documentation site.",
    path: "content/overview.md"
  },
  {
    id: "getting-started",
    title: "Getting Started",
    description: "How to use this extension and the documentation site.",
    path: "content/getting-started.md"
  },
  {
    id: "api-reference",
    title: "API Reference",
    description: "Information about the extension commands, settings, and contribution points.",
    path: "content/api-reference.md"
  },
  {
    id: "contributing",
    title: "Contributing",
    description: "Guidelines for improving and extending this documentation repository.",
    path: "content/contribution.md"
  },
  {
    id: "standard-documentation",
    title: "Standard Documentation",
    description: "Documentation standards and how this site serves as a repo for core documentation.",
    path: "content/standard-documentation.md"
  },
  {
    id: "powerbi-dashboard",
    title: "Power BI Dashboard",
    description: "Interactive analytics dashboard that loads the Observations workbook.",
    path: "content/powerbi-dashboard.md"
  }
];

const navList = document.getElementById("navList");
const pageTitle = document.getElementById("pageTitle");
const pageDescription = document.getElementById("pageDescription");
const pageContent = document.getElementById("pageContent");
const searchInput = document.getElementById("searchInput");

function renderNav(filter = "") {
  navList.innerHTML = "";
  const normalized = filter.trim().toLowerCase();
  docs.forEach((doc) => {
    const text = `${doc.title} ${doc.description}`.toLowerCase();
    if (!normalized || text.includes(normalized)) {
      const link = document.createElement("a");
      link.href = `#${doc.id}`;
      link.className = "nav-link";
      link.textContent = doc.title;
      link.dataset.id = doc.id;
      navList.appendChild(link);
    }
  });
}

function setActiveNav(id) {
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.id === id);
  });
}

function markdownToHtml(markdown) {
  const escaped = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/^###### (.*$)/gim, "<h6>$1</h6>")
    .replace(/^##### (.*$)/gim, "<h5>$1</h5>")
    .replace(/^#### (.*$)/gim, "<h4>$1</h4>")
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/gim, "<em>$1</em>")
    .replace(/`([^`]+)`/gim, "<code>$1</code>")
    .replace(/\n-{3,}\n/g, "<hr />")
    .replace(/\n\n+/g, "\n\n")
    .replace(/\n\* (.*)/g, "<li>$1</li>")
    .replace(/<(li)>/g, "<$1>")
    .replace(/\n(\d+)\. (.*)/g, "<li>$2</li>")
    .replace(/\[(.*?)\]\((.*?)\)/g, "<a href='$2'>$1</a>")
    .split(/\n\n/)
    .map((block) => {
      if (block.startsWith("<h") || block.startsWith("<ul") || block.startsWith("<ol") || block.startsWith("<pre") || block.startsWith("<hr")) {
        return block;
      }
      if (block.startsWith("<li>")) {
        return `<ul>${block}</ul>`;
      }
      if (/^<h[1-6]>/.test(block)) {
        return block;
      }
      if (/^<pre>/.test(block) || /^<code>/.test(block)) {
        return block;
      }
      return `<p>${block}</p>`;
    })
    .join("");
}

function renderPage(pageId) {
  const doc = docs.find((item) => item.id === pageId) || docs[0];
  window.location.hash = `#${doc.id}`;
  pageTitle.textContent = doc.title;
  pageDescription.textContent = doc.description;
  setActiveNav(doc.id);

  fetch(doc.path)
    .then((response) => response.text())
    .then((markdown) => {
      pageContent.innerHTML = markdownToHtml(markdown);
    })
    .catch(() => {
      pageContent.innerHTML = "<p>Unable to load the requested content. Please run the local docs server and refresh the page.</p>";
    });
}

searchInput.addEventListener("input", (event) => {
  renderNav(event.target.value);
});

window.addEventListener("hashchange", () => {
  renderPage(window.location.hash.slice(1));
});

navList.addEventListener("click", (event) => {
  const anchor = event.target.closest(".nav-link");
  if (!anchor) return;
  event.preventDefault();
  renderPage(anchor.dataset.id);
});

renderNav();
renderPage(window.location.hash.slice(1) || docs[0].id);
