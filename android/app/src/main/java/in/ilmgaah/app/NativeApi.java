package in.ilmgaah.app;

import android.os.Handler;
import android.os.Looper;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class NativeApi {
    interface Callback {
        void done(Result result);
    }

    static final class Result {
        final int status;
        final String body;
        final String error;

        Result(int status, String body, String error) {
            this.status = status;
            this.body = body;
            this.error = error;
        }

        boolean ok() {
            return status >= 200 && status < 300;
        }
    }

    private static final ExecutorService IO = Executors.newCachedThreadPool();
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    static void postJson(String url, String body, String apiKey, Callback callback) {
        request("POST", url, body, apiKey, null, callback);
    }

    static void get(String url, String token, Callback callback) {
        request("GET", url, null, null, token, callback);
    }
    private static void request(
            final String method,
            final String urlString,
            final String body,
            final String apiKey,
            final String bearer,
            final Callback callback
    ) {
        IO.execute(() -> {
            Result result;
            HttpURLConnection connection = null;
            try {
                URL url = new URL(urlString);
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod(method);
                connection.setConnectTimeout(12000);
                connection.setReadTimeout(18000);
                connection.setUseCaches(false);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("Cache-Control", "no-store");
                if (apiKey != null && !apiKey.isEmpty()) {
                    connection.setRequestProperty("apikey", apiKey);
                }
                if (bearer != null && !bearer.isEmpty()) {
                    connection.setRequestProperty("Authorization", "Bearer " + bearer);
                }
                if (body != null) {
                    connection.setRequestProperty("Content-Type", "application/json");
                    connection.setDoOutput(true);
                    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                    try (OutputStream output = connection.getOutputStream()) {
                        output.write(bytes);
                    }
                }
                int status = connection.getResponseCode();
                InputStream stream = status >= 400
                        ? connection.getErrorStream()
                        : connection.getInputStream();
                String responseBody = read(stream);
                result = new Result(status, responseBody, null);
            } catch (Exception exception) {
                result = new Result(0, "", exception.getClass().getSimpleName());
            } finally {
                if (connection != null) connection.disconnect();
            }

            final Result delivered = result;
            MAIN.post(() -> callback.done(delivered));
        });
    }

    private static String read(InputStream stream) throws Exception {
        if (stream == null) return "";
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line);
            }
        }
        return builder.toString();
    }

    static JSONObject json(String body) {
        try {
            return new JSONObject(body == null || body.isEmpty() ? "{}" : body);
        } catch (Exception ignored) {
            return new JSONObject();
        }
    }

    private NativeApi() {}
}
