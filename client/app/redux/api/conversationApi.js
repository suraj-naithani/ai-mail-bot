import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const baseUrl =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:7894";

export const conversationApi = createApi({
  reducerPath: "conversationApi",
  baseQuery: fetchBaseQuery({
    baseUrl,
    credentials: "include",
  }),
  tagTypes: ["Conversation", "Chat"],
  endpoints: (builder) => ({
    getConversations: builder.query({
      query: () => "conversations",
      providesTags: ["Conversation"],
    }),
    getConversation: builder.query({
      query: (id) => `conversations/${id}`,
      providesTags: (result, error, id) => [{ type: "Conversation", id }],
    }),
    createConversation: builder.mutation({
      query: (body) => ({
        url: "conversations",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Conversation"],
    }),
    updateConversation: builder.mutation({
      query: ({ id, body }) => ({
        url: `conversations/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Conversation", id },
      ],
    }),
    deleteConversation: builder.mutation({
      query: (id) => ({
        url: `conversations/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Conversation"],
    }),
    getConversationChats: builder.query({
      query: (id) => `conversations/${id}/chats`,
      providesTags: (result, error, id) => [{ type: "Chat", id }],
    }),
    sendConversationMessage: builder.mutation({
      async queryFn({ conversationId, message, onChunk, onMetadata, onDone, onTitle }) {
        try {
          const response = await fetch(
            `${baseUrl}/conversations/${conversationId}/chats`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ message }),
            }
          );

          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            return {
              error: {
                status: response.status,
                data: payload,
              },
            };
          }

          const reader = response.body?.getReader();
          if (!reader) {
            return {
              error: {
                status: "NO_STREAM",
                data: "No response stream available",
              },
            };
          }

          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine) continue;
              let data;
              try {
                data = JSON.parse(trimmedLine);
              } catch {
                continue;
              }
              if (data.type === "metadata") {
                onMetadata?.(data);
              } else if (
                data.type === "chunk" &&
                typeof data.content === "string"
              ) {
                onChunk?.(data.content);
              } else if (data.type === "title" && typeof data.title === "string") {
                onTitle?.(data.title);
              } else if (data.type === "done") {
                onDone?.();
              } else if (data.type === "error") {
                return {
                  error: {
                    status: "STREAM_ERROR",
                    data: data.message || "Stream error",
                  },
                };
              }
            }
          }

          return { data: { success: true } };
        } catch (error) {
          return {
            error: {
              status: "FETCH_ERROR",
              data: error?.message || "Failed to send message",
            },
          };
        }
      },
      invalidatesTags: (result, error, { conversationId }) => [
        { type: "Chat", id: conversationId },
        { type: "Conversation", id: conversationId },
      ],
    }),
  }),
});

export const {
  useGetConversationsQuery,
  useGetConversationQuery,
  useCreateConversationMutation,
  useUpdateConversationMutation,
  useDeleteConversationMutation,
  useGetConversationChatsQuery,
  useSendConversationMessageMutation,
} = conversationApi;
