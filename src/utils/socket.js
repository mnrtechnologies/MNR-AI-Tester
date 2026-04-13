import { io } from "socket.io-client";

const BASE_URL = process.env.REACT_APP_AUTH_URL.replace("/api", "");

// const socket = io(BASE_URL, {

//   autoConnect: false,

//   auth: {
//     token: localStorage.getItem("token"),
//   },

//   transports: ["websocket"],

// });

const socket = io("BASE_URL", {
  path: "/socket.io/", 
  transports: ["websocket"] // Force websockets to avoid long-polling ALB issues
});

export default socket;