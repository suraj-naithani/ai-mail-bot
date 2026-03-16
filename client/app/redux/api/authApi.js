import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const baseUrl =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:7894";

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: fetchBaseQuery({
    baseUrl,
    credentials: "include",
  }),
  tagTypes: ["Auth"],
  endpoints: (builder) => ({
    getGoogleAuth: builder.query({
      query: () => "auth/google",
    }),
    getGoogleCallback: builder.query({
      query: () => "auth/google/callback",
    }),
    getDashboard: builder.query({
      query: () => "auth/dashboard",
      providesTags: ["Auth"],
    }),
    getSessionUser: builder.query({
      query: () => ({
        url: "auth/session-user",
        method: "POST",
      }),
      providesTags: ["Auth"],
    }),
    logout: builder.mutation({
      query: () => ({
        url: "auth/logout",
        method: "GET",
      }),
      invalidatesTags: ["Auth"],
    }),
  }),
});

export const {
  useGetGoogleAuthQuery,
  useLazyGetGoogleAuthQuery,
  useGetGoogleCallbackQuery,
  useLazyGetGoogleCallbackQuery,
  useGetDashboardQuery,
  useGetSessionUserQuery,
  useLogoutMutation,
} = authApi;
