const authHandlers = {
  signup: async (msg) => {
    console.log("Signup handler called", msg);
  },
  login: async (msg) => {
    console.log("Login handler called", msg);
    const data = typeof msg.data === "string" ? JSON.parse(msg.data) : msg.data;
    const { userId, email } = data || {};
    console.log("User logged in", userId, email);
  },
  logout: async (msg) => {
    console.log("Logout handler called", msg);
  },
  "forgot-password": async (msg) => {
    console.log("Forgot password handler called", msg);
  },
};

module.exports = authHandlers;
