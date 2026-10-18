// The Client version identity, compiled in from `client-version.json`.
//
// Every Service request announces this value, so the Service can reject a
// Client it cannot serve. The header name and the value live together here so
// the Axios interceptor and the SSE connection cannot drift apart.
export const CLIENT_VERSION_HEADER = 'X-AnyWear-Client-Version';

export const CLIENT_VERSION = __CLIENT_VERSION__;
