import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const URL = import.meta.env.VITE_BASE_URL_V2 || "http://localhost:5000";

// ✅ helper: set cookie
function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

// ✅ helper: delete cookie
function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

// ✅ helper: get cookie
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}

function IconApple() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M16.365 1.43c-.83.97-1.9 1.58-3.08 1.47-..." />
    </svg>
  );
}

function IconGoogle() {
  return (
    <svg width="20" height="20" viewBox="0 0 533.5 544.3" xmlns="http://www.w3.org/2000/svg">
      <path d="M533.5 278.4c0-18.6-1.6-37.6-4.9-55.7H272v105.6h146.9c-6.3 34.3-25.2 63.5-53.6 83v68h86.5C500.6 418.1 533.5 353.2 533.5 278.4z" />
    </svg>
  );
}

const AuthModal = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const isEmail = (v) => /\S+@\S+\.\S+/.test(v);
  const minPass = 6;

  function clearMessages() {
    setMessage(null);
    setErrors({});
  }

  function handleToggle(next) {
    clearMessages();
    setMode(next);
  }

  async function apiPost(path, body) {
    const res = await fetch(URL + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include", // 👈 this line is important
    });
    const data = await res.json();

    if (!res.ok) {
      const err = data?.error || `Request failed: ${res.status}`;
      const e = new Error(err);
      e.payload = data;
      throw e;
    }
    return data;
  }

  async function handleSignup(e) {
    e.preventDefault();
    clearMessages();

    const { name, email, password, confirm } = signupData;
    const newErrors = {};
    if (!name.trim()) newErrors.name = "Name is required";
    if (!email.trim()) newErrors.email = "Email is required";
    else if (!isEmail(email)) newErrors.email = "Enter a valid email";
    if (!password) newErrors.password = "Password is required";
    else if (password.length < minPass) newErrors.password = `Password must be at least ${minPass} characters`;
    if (password !== confirm) newErrors.confirm = "Passwords do not match";

    setErrors(newErrors);
    if (Object.keys(newErrors).length) return;

    setLoading(true);
    try {
      const data = await apiPost("/api/signup", { name: name.trim(), email: email.trim(), password });
      // ✅ store token in cookie (7 days)
      setCookie("auth_token", data.token, 7);
      console.log(data);
      
      setCookie("auth_user", JSON.stringify(data.user), 7);

      setMessage({ type: "success", text: `Signup successful — welcome, ${data.user.name}` });
      setSignupData({ name: "", email: "", password: "", confirm: "" });
      setMode("login");
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Signup failed" });
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    clearMessages();

    const { email, password } = loginData;
    const newErrors = {};
    if (!email.trim()) newErrors.email = "Email is required";
    else if (!isEmail(email)) newErrors.email = "Enter a valid email";
    if (!password) newErrors.password = "Password is required";

    setErrors(newErrors);
    if (Object.keys(newErrors).length) return;

    setLoading(true);
    try {
      const incriptedPassword = btoa(password); // simple base64 encoding for demo; use stronger encryption in production
      const data = await apiPost("/api/login", { email: email.trim(), password: incriptedPassword });
      // ✅ store token in cookie (7 days)
      setCookie("auth_token", data.token, 7);
      setCookie("auth_user", JSON.stringify(data.user), 7);

      setMessage({ type: "success", text: `Logged in as ${data.user.name}` });
      setLoginData({ email: "", password: "" });
      navigate("/");
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Login failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 mt-40 rounded-2xl shadow-lg">

      {/* TITLE */}
      <h3 className="text-center text-2xl font-semibold mb-5">
        {mode === "login" ? "Account Log in" : "Create Account"}
      </h3>

      {/* Toggle between login and signup */}
      <div className="flex justify-center mb-5">
        <div className="flex space-x-2">
          <button
            onClick={() => handleToggle("login")}
            className={`px-4 py-2 rounded-lg font-medium ${mode === "login"
              ? "bg-teal-600 text-white"
              : "border border-gray-300 text-gray-600"
              }`}
          >
            Login
          </button>
          <button
            onClick={() => handleToggle("signup")}
            className={`px-4 py-2 rounded-lg font-medium ${mode === "signup"
              ? "bg-teal-600 text-white"
              : "border border-gray-300 text-gray-600"
              }`}
          >
            Signup
          </button>
        </div>
      </div>

      {/* ERROR MESSAGES */}
      {message && (
        <div
          className={`p-2 rounded text-center text-sm mb-4 ${message.type === "success"
            ? "bg-green-100 text-green-700"
            : "bg-red-100 text-red-700"
            }`}
        >
          {message.text}
        </div>
      )}

      {/* LOGIN FORM */}
      {mode === "login" ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="font-medium">Email</label>
            <input
              type="email"
              className={`w-full border rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 ${errors.email ? "border-red-500 focus:ring-red-400" : "focus:ring-teal-400"
                }`}
              value={loginData.email}
              onChange={(e) => setLoginData(p => ({ ...p, email: e.target.value }))}
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="font-medium">Password</label>
            <input
              type="password"
              className={`w-full border rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 ${errors.password ? "border-red-500 focus:ring-red-400" : "focus:ring-teal-400"
                }`}
              value={loginData.password}
              onChange={(e) => setLoginData(p => ({ ...p, password: e.target.value }))}
            />
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
          </div>

          <button
            type="submit"
            className="w-full bg-teal-600 text-white py-2 rounded-lg font-semibold hover:bg-teal-700 transition"
            disabled={loading}
          >
            {loading ? "Please wait..." : "Sign in"}
          </button>
        </form>
      ) : (
        /* SIGNUP FORM */
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="font-medium">Full Name</label>
            <input
              type="text"
              className={`w-full border rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 ${errors.name ? "border-red-500 focus:ring-red-400" : "focus:ring-teal-400"
                }`}
              value={signupData.name}
              onChange={(e) => setSignupData(p => ({ ...p, name: e.target.value }))}
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="font-medium">Email</label>
            <input
              type="email"
              className={`w-full border rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 ${errors.email ? "border-red-500 focus:ring-red-400" : "focus:ring-teal-400"
                }`}
              value={signupData.email}
              onChange={(e) => setSignupData(p => ({ ...p, email: e.target.value }))}
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="font-medium">Password</label>
            <input
              type="password"
              className={`w-full border rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 ${errors.password ? "border-red-500 focus:ring-red-400" : "focus:ring-teal-400"
                }`}
              value={signupData.password}
              onChange={(e) => setSignupData(p => ({ ...p, password: e.target.value }))}
            />
          </div>

          <div>
            <label className="font-medium">Confirm Password</label>
            <input
              type="password"
              className={`w-full border rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 ${errors.confirm ? "border-red-500 focus:ring-red-400" : "focus:ring-teal-400"
                }`}
              value={signupData.confirm}
              onChange={(e) => setSignupData(p => ({ ...p, confirm: e.target.value }))}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-teal-600 text-white py-2 rounded-lg font-semibold hover:bg-teal-700 transition"
            disabled={loading}
          >
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>
      )}
    </div>
  );
}

export default AuthModal;