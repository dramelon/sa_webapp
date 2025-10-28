// View logic only. Controller: login.php
(function () {
  const params = new URLSearchParams(location.search);
  const error = params.get("error");
  const created = params.get("created");
  const box = document.getElementById("formMsg");

  if (!box) return;

  if (error) {
    box.textContent =
      error === "1"
        ? "Incorrect username or password"
        : error === "exists"
        ? "Username or email already exists"
        : error === "missing"
        ? "Please fill all required fields"
        : "Server error";
    box.hidden = false;
    box.classList.remove("ok");
  } else if (created) {
    box.textContent = "Account created. Please log in";
    box.hidden = false;
    box.classList.add("ok");
  }

  // optional UX: clean the query string after rendering
  if (error || created) {
    try {
      history.replaceState(null, "", location.pathname);
    } catch (_) {}
  }
})();
