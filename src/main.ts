import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import i18n from "./i18n";
import "ant-design-vue/dist/reset.css";
import "./styles/global.less";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(i18n);
app.mount("#app");

window.addEventListener("load", () => {
  window.setTimeout(() => {
    const splash = document.getElementById("splash");
    if (!splash) return;
    splash.classList.add("hide");
    window.setTimeout(() => splash.remove(), 600);
  }, 300);
});
