import { configureStore } from "@reduxjs/toolkit";
import { authApi } from "./api/authApi";
import { gmailApi } from "./api/gmailApi";
import { conversationApi } from "./api/conversationApi";

const store = configureStore({
  reducer: {
    [authApi.reducerPath]: authApi.reducer,
    [gmailApi.reducerPath]: gmailApi.reducer,
    [conversationApi.reducerPath]: conversationApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["conversationApi/executeMutation"],
        ignoredPaths: ["conversationApi.mutations"],
      },
    }).concat(authApi.middleware, gmailApi.middleware, conversationApi.middleware),
});

export default store;
