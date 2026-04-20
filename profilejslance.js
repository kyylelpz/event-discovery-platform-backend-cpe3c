// ELEMENTS
const username = document.getElementById("username");
const email = document.getElementById("email");
const phone = document.getElementById("phone");
const bio = document.getElementById("bio");
const profilePic = document.getElementById("profilePic");
const imageUpload = document.getElementById("imageUpload");
const editModal = document.getElementById("editModal");

const newUsername = document.getElementById("newUsername");
const newEmail = document.getElementById("newEmail");
const newPhone = document.getElementById("newPhone");
const newBio = document.getElementById("newBio");

const API_URL = "http://localhost:3000/api/profile"; // local

// OR if deployed:
/// const API_URL = "https://your-app.onrender.com/api/profile";

// GLOBAL USER
let user = {};

// LOAD PROFILE
async function loadProfile() {
    try {
        const res = await fetch(API_URL);
        user = await res.json();

        username.innerText = user.username;
        email.innerText = user.email;
        phone.innerText = user.phone;
        bio.innerText = user.bio;
        profilePic.src = user.profilePic;

    } catch (err) {
        console.error("LOAD ERROR:", err);
        alert("Cannot connect to server");
    }
}

// IMAGE UPLOAD
function openFile() {
    imageUpload.click();
}

imageUpload.addEventListener("change", function(e) {
    const file = e.target.files[0];
    if(file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            profilePic.src = event.target.result;
            user.profilePic = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// MODAL
function openModal() {
    newUsername.value = user.username;
    newEmail.value = user.email;
    newPhone.value = user.phone;
    newBio.value = user.bio;

    editModal.classList.add("show");
}

function closeModal() {
    editModal.classList.remove("show");
}

// CLICK OUTSIDE CLOSE
window.onclick = function(e) {
    if (e.target === editModal) {
        closeModal();
    }
};

// UPDATE PROFILE (FIXED)
async function updateProfile() {
    const updatedData = {
        username: newUsername.value.trim() || user.username,
        email: newEmail.value.trim() || user.email,
        phone: newPhone.value.trim() || user.phone,
        bio: newBio.value.trim() || user.bio,
        profilePic: user.profilePic
    };

    try {
        const res = await fetch("http://localhost:3000/api/profile", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(updatedData)
        });

        if (!res.ok) throw new Error("Server error");

        user = await res.json();

        alert("Profile Updated!");
        loadProfile();
        closeModal();

    } catch (err) {
        console.error("UPDATE ERROR:", err);
        alert("Error updating profile");
    }
}

// THEMES
const themes = {
    light: {
        primary: "#1a73e8",
        secondary: "#ffffff",
        accent: "#1669c1",
        text: "#202124",
        card: "#ffffff",
        inputBg: "#ffffff",
        border: "#dadce0"
    },
    dark: {
        primary: "#8ab4f8",
        secondary: "#202124",
        accent: "#669df6",
        text: "#e8eaed",
        card: "#303134",
        inputBg: "#3c4043",
        border: "#5f6368"
    }
};

function changeTheme(name) {
    const t = themes[name];
    if (!t) return;

    localStorage.setItem("theme", name);

    document.documentElement.style.setProperty('--primary', t.primary);
    document.documentElement.style.setProperty('--secondary', t.secondary);
    document.documentElement.style.setProperty('--accent', t.accent);
    document.documentElement.style.setProperty('--text', t.text);
    document.documentElement.style.setProperty('--card', t.card);
    document.documentElement.style.setProperty('--input-bg', t.inputBg);
    document.documentElement.style.setProperty('--border', t.border);

    if (name === "dark") {
        document.body.style.background = "#202124";
    } else {
        document.body.style.background =
            `linear-gradient(to right, ${t.primary}, ${t.secondary})`;
    }
}

// INIT
window.onload = () => {
    const saved = localStorage.getItem("theme") || "light";
    changeTheme(saved);
    loadProfile();
};
