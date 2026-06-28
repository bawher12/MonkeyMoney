document.addEventListener("DOMContentLoaded", () => {
  const box = document.getElementById("giscus-comments");
  const placeholder = document.getElementById("comments-placeholder");
  if (!box) return;

  const repo = box.getAttribute("data-repo");
  const repoId = box.getAttribute("data-repo-id");
  const isConfigured =
    repo &&
    !repo.includes("TU-USUARIO") &&
    repoId &&
    !repoId.includes("REPO_ID_AQUI");

  if (!isConfigured) {
    // Keep showing the friendly placeholder until real Giscus IDs are set.
    return;
  }

  const script = document.createElement("script");
  script.src = "https://giscus.app/client.js";
  script.setAttribute("data-repo", repo);
  script.setAttribute("data-repo-id", repoId);
  script.setAttribute("data-category", box.getAttribute("data-category"));
  script.setAttribute("data-category-id", box.getAttribute("data-category-id"));
  script.setAttribute("data-mapping", "pathname");
  script.setAttribute("data-strict", "0");
  script.setAttribute("data-reactions-enabled", "1");
  script.setAttribute("data-emit-metadata", "0");
  script.setAttribute("data-input-position", "top");
  script.setAttribute("data-theme", "light");
  script.setAttribute("data-lang", document.documentElement.getAttribute("lang") || "es");
  script.crossOrigin = "anonymous";
  script.async = true;
  box.appendChild(script);

  if (placeholder) placeholder.style.display = "none";
});
