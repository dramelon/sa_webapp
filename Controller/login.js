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
                ? "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
                : error === "unauth"
                    ? "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง"
                    : error === "exists"
                        ? "ชื่อผู้ใช้หรืออีเมลถูกใช้งานแล้ว"
                        : error === "missing"
                            ? "กรุณากรอกข้อมูลให้ครบถ้วน"
                            : error === "status"
                                ? "บัญชีของคุณถูกระงับ กรุณาติดต่อผู้ดูแลระบบ"
                                : "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง";
        box.hidden = false;
        box.classList.remove("ok");
    } else if (created) {
        box.textContent = "สร้างบัญชีใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบ";
        box.hidden = false;
        box.classList.add("ok");
    }

    // optional UX: clean the query string after rendering
    if (error || created) {
        try {
            history.replaceState(null, "", location.pathname);
        } catch (_) { }
    }
})();
