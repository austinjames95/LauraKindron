async function loadFooter() {
    try {
        const response = await fetch("/src/footer/footer.html");
        if (!response.ok) throw new Error("Failed to load footer");
        const html = await response.text();
        document.getElementById("footer").innerHTML = html;
    } catch (error) {
        console.error("Error loading footer:", error);
    }
}

document.addEventListener("DOMContentLoaded", loadFooter);