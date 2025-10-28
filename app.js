let n = 0;
const count = document.querySelector("#count");
const inc = document.querySelector("#inc");
const dec = document.querySelector("#dec");

function render() { count.textContent = n; }
inc.addEventListener("click", () => { n++; render(); });
dec.addEventListener("click", () => { n--; render(); });
render()
