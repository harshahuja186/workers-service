const authHandlers = {
  signup: async (data) => {
    console.log("Signup handler called", data);
  },
  login: async (data) => {
    console.log("Login handler called", data);
    const { userId, email } = data || {};
    console.log("User logged in", userId, email);
  },
  logout: async (data) => {
    console.log("Logout handler called", data);
  },
  "forgot-password": async (data) => {
    console.log("Forgot password handler called", data);
  },
};

module.exports = authHandlers;
