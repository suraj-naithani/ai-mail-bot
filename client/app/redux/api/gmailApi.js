import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const baseUrl =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:7894";

export const gmailApi = createApi({
  reducerPath: "gmailApi",
  baseQuery: fetchBaseQuery({
    baseUrl,
    credentials: "include",
  }),
  tagTypes: ["Gmail"],
  endpoints: (builder) => ({
    getGmailConnect: builder.query({
      query: () => "auth/gmail/connect",
    }),
    getGmailCallback: builder.query({
      query: () => "auth/gmail/callback",
    }),
    getGmailMessages: builder.query({
      query: () => "auth/gmail/messages",
      providesTags: ["Gmail"],
    }),
    syncGmail: builder.mutation({
      query: (params = {}) => {
        const searchParams = new URLSearchParams();
        if (params?.all) {
          searchParams.set("all", "true");
        }
        const queryString = searchParams.toString();
        return {
          url: `auth/gmail/sync${queryString ? `?${queryString}` : ""}`,
          method: "POST",
        };
      },
      invalidatesTags: ["Gmail"],
    }),
    aiResponse: builder.mutation({
      query: (body) => ({
        url: "auth/gmail/ai-response",
        method: "POST",
        body,
      }),
    }),
  }),
});

export const {
  useGetGmailConnectQuery,
  useLazyGetGmailConnectQuery,
  useGetGmailCallbackQuery,
  useLazyGetGmailCallbackQuery,
  useGetGmailMessagesQuery,
  useSyncGmailMutation,
  useAiResponseMutation,
} = gmailApi;
