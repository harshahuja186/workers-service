const todoAuthHandlers = require("./todo/todo-auth");

module.exports = {
  todo: {
    ...todoAuthHandlers,
  },
};
