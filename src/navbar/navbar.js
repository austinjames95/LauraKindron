async function loadNavbar() {
    try {
        const response = await fetch("/src/navbar/navbar.html",);
        if (!response.ok) throw new Error("Failed to load navbar");
        const navbarHTML = await response.text();
        document.getElementById("navbar").innerHTML = navbarHTML;

        // Set active nav link based on current page
        setActiveNavLink();
    } catch (error) {
        console.error("Error loading navbar:", error);
    }
}


document.addEventListener("DOMContentLoaded", loadNavbar);