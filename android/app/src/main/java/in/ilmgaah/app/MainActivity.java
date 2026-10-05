package in.ilmgaah.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DatePickerDialog;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.graphics.Color;
import android.graphics.Typeface;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.os.Bundle;
import android.text.InputType;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.ArrayAdapter;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

import android.database.Cursor;
import android.provider.OpenableColumns;

public class MainActivity extends Activity {
    private static final int GREEN = Color.rgb(22, 132, 90);
    private static final int GREEN_DARK = Color.rgb(8, 67, 47);
    private static final int GREEN_DEEP = Color.rgb(5, 49, 35);
    private static final int GREEN_SOFT = Color.rgb(231, 245, 238);
    private static final int MINT = Color.rgb(244, 249, 246);
    private static final int BLUE = Color.rgb(23, 105, 168);
    private static final int BLUE_SOFT = Color.rgb(234, 243, 251);
    private static final int BG = Color.rgb(247, 250, 248);
    private static final int TEXT = Color.rgb(23, 33, 27);
    private static final int MUTED = Color.rgb(101, 115, 107);
    private static final int BORDER = Color.rgb(220, 229, 223);
    private static final int ADMISSION_PHOTO_REQUEST = 701;
    private static final int MAX_ADMISSION_PHOTO_BYTES = 5 * 1024 * 1024;
    private static final String AUTH_PREFS = "ilmgaah_auth";
    private static final String REMEMBERED_SESSION_KEY = "remembered_session";
    private static final String REMEMBERED_LAST_OPEN_KEY = "remembered_last_open_ms";
    private static final String REMEMBERED_KEY_ALIAS = "ilmgaah_remembered_session_v1";
    private static final int GCM_TAG_LENGTH = 128;
    private static final long TOKEN_EXPIRY_SKEW_SECONDS = 60L;

    private FrameLayout root;
    private LinearLayout content;
    private LinearLayout bottomNav;
    private String currentScreen = "home";
    private TextView headerTitle;
    private TextView headerMeta;
    private TextView connectionState;
    private Button signInButton;
    private CheckBox rememberMeToggle;
    private TextView loginError;
    private long sessionGeneration = 0L;

    private String accessToken = "";
    private JSONObject authSession;
    private String surface = "admin";
    private Uri admissionPhotoUri;
    private String admissionPhotoToken = "";
    private int admissionDraftId = 0;
    private TextView admissionPhotoStatus;

    private static final class AdmissionOption {
        final int id;
        final String label;
        final int sessionId;
        final int programId;

        AdmissionOption(int id, String label) {
            this(id, label, 0, 0);
        }

        AdmissionOption(int id, String label, int sessionId, int programId) {
            this.id = id;
            this.label = label;
            this.sessionId = sessionId;
            this.programId = programId;
        }

        @Override
        public String toString() {
            return label;
        }
    }

    private String admissionCookie() {
        if (authSession == null || accessToken.isEmpty()) return "";
        try {
            JSONObject session = new JSONObject();
            session.put("access_token", accessToken);
            session.put("refresh_token", authSession.optString("refresh_token", ""));
            session.put("token_type", authSession.optString("token_type", "bearer"));
            session.put("expires_in", authSession.optLong("expires_in", 3600));
            session.put("expires_at", authSession.optLong("expires_at", 0));
            JSONObject user = authSession.optJSONObject("user");
            if (user != null) session.put("user", user);
            String encoded = Base64.encodeToString(
                    session.toString().getBytes(StandardCharsets.UTF_8),
                    Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
            return NativeApi.chunkedCookie("supabase.auth.token", "base64-" + encoded);
        } catch (Exception ignored) {
            return "";
        }
    }

    private String localizedOptionLabel(JSONObject row, String fallback) {
        JSONObject labels = row.optJSONObject("labels");
        if (labels == null) return fallback;
        String locale = englishMode() ? "en" : "ur";
        String value = labels.optString(locale, "");
        if (value.isEmpty()) value = labels.optString("en", "");
        return value.isEmpty() ? fallback : value;
    }

    private String isoToday() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }
    private int tenantId = 0;
    private int branchId = 0;
    private String liveStudents = "—";
    private String liveAttendance = "—";
    private String liveStaff = "—";
    private String liveAdmissions = "—";
    private int parentChildren = 0;
    private JSONObject guardianPayload;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(GREEN_DARK);
        getWindow().setNavigationBarColor(Color.WHITE);
        root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        setContentView(root);
        showLogin();
        restoreRememberedSession();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (accessToken.isEmpty() || !authPreferences().contains(REMEMBERED_SESSION_KEY)) return;
        long lastOpen = authPreferences().getLong(REMEMBERED_LAST_OPEN_KEY, 0L);
        if (!rememberWindowValid(lastOpen)) {
            clearRememberedSession();
            showLogin();
            return;
        }
        touchRememberedSession();
    }

    private int dp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private boolean englishMode() {
        return getPreferences(Context.MODE_PRIVATE).getBoolean("language_english", false);
    }

    private String tr(String urdu, String english) {
        return englishMode() ? english : urdu;
    }


    private android.content.SharedPreferences authPreferences() {
        return getSharedPreferences(AUTH_PREFS, Context.MODE_PRIVATE);
    }

    private SecretKey rememberedSessionKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (!keyStore.containsAlias(REMEMBERED_KEY_ALIAS)) {
            KeyGenerator keyGenerator = KeyGenerator.getInstance(
                    KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            keyGenerator.init(new KeyGenParameterSpec.Builder(
                    REMEMBERED_KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .build());
            keyGenerator.generateKey();
        }
        return (SecretKey) keyStore.getKey(REMEMBERED_KEY_ALIAS, null);
    }

    private String encryptRememberedSession(JSONObject session) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, rememberedSessionKey());
        JSONObject envelope = new JSONObject();
        envelope.put("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP));
        envelope.put("data", Base64.encodeToString(
                cipher.doFinal(session.toString().getBytes(StandardCharsets.UTF_8)),
                Base64.NO_WRAP));
        return envelope.toString();
    }

    private JSONObject decryptRememberedSession(String encoded) throws Exception {
        JSONObject envelope = new JSONObject(encoded);
        byte[] iv = Base64.decode(envelope.optString("iv", ""), Base64.NO_WRAP);
        byte[] data = Base64.decode(envelope.optString("data", ""), Base64.NO_WRAP);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, rememberedSessionKey(),
                new GCMParameterSpec(GCM_TAG_LENGTH, iv));
        return new JSONObject(new String(
                cipher.doFinal(data), StandardCharsets.UTF_8));
    }

    private void clearRememberedSession() {
        authPreferences().edit()
                .remove(REMEMBERED_SESSION_KEY)
                .remove(REMEMBERED_LAST_OPEN_KEY)
                .apply();
    }

    private boolean rememberWindowValid(long lastOpenMs) {
        if (lastOpenMs <= 0) return false;
        Calendar cutoff = Calendar.getInstance();
        cutoff.add(Calendar.MONTH, -5);
        return lastOpenMs > cutoff.getTimeInMillis();
    }

    private void touchRememberedSession() {
        if (!authPreferences().contains(REMEMBERED_SESSION_KEY)) return;
        authPreferences().edit()
                .putLong(REMEMBERED_LAST_OPEN_KEY, System.currentTimeMillis())
                .apply();
    }

    private JSONObject rememberedSession() {
        android.content.SharedPreferences prefs = authPreferences();
        String encoded = prefs.getString(REMEMBERED_SESSION_KEY, "");
        long lastOpen = prefs.getLong(REMEMBERED_LAST_OPEN_KEY, 0L);
        if (encoded.isEmpty() || !rememberWindowValid(lastOpen)) {
            if (!encoded.isEmpty()) clearRememberedSession();
            return null;
        }
        try {
            return decryptRememberedSession(encoded);
        } catch (Exception ignored) {
            clearRememberedSession();
            return null;
        }
    }

    private boolean accessTokenFresh(JSONObject session) {
        long expiresAt = session.optLong("expires_at", 0L);
        return expiresAt > (System.currentTimeMillis() / 1000L) + TOKEN_EXPIRY_SKEW_SECONDS;
    }

    private void persistRememberedSession() {
        if (authSession == null || accessToken.length() < 20) return;
        try {
            JSONObject stored = new JSONObject(authSession.toString());
            stored.put("workspaceTenantId", tenantId);
            stored.put("workspaceBranchId", branchId);
            stored.put("workspaceSurface", surface);
            String encrypted = encryptRememberedSession(stored);
            authPreferences().edit()
                    .putString(REMEMBERED_SESSION_KEY, encrypted)
                    .putLong(REMEMBERED_LAST_OPEN_KEY, System.currentTimeMillis())
                    .apply();
        } catch (Exception ignored) {
            clearRememberedSession();
        }
    }

    private void restoreRememberedSession() {
        JSONObject stored = rememberedSession();
        if (stored == null) return;

        accessToken = stored.optString("access_token", "");
        authSession = stored;
        tenantId = stored.optInt("workspaceTenantId", 0);
        branchId = stored.optInt("workspaceBranchId", 0);
        surface = stored.optString("workspaceSurface", "admin");
        if (accessToken.length() < 20) {
            clearRememberedSession();
            showLogin();
            return;
        }

        if (rememberMeToggle != null) rememberMeToggle.setChecked(true);
        if (signInButton != null) {
            signInButton.setEnabled(false);
            signInButton.setText(tr("سیشن بحال ہو رہا ہے…", "Restoring session…"));
        }

        if (accessTokenFresh(stored)) {
            touchRememberedSession();
            bootstrap(loginError, true);
            return;
        }

        String refreshToken = stored.optString("refresh_token", "");
        if (refreshToken.isEmpty()) {
            clearRememberedSession();
            showLogin();
            return;
        }

        try {
            JSONObject body = new JSONObject();
            body.put("refresh_token", refreshToken);
            NativeApi.postJson(
                    BuildConfig.SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token",
                    body.toString(),
                    BuildConfig.SUPABASE_PUBLISHABLE_KEY,
                    result -> {
                        if (!result.ok()) {
                            if (result.status == 400 || result.status == 401) {
                                clearRememberedSession();
                            }
                            accessToken = "";
                            authSession = null;
                            if (rememberMeToggle != null) rememberMeToggle.setChecked(false);
                            showLogin();
                            if (loginError != null) {
                                loginError.setText(tr(
                                        "سیشن بحال نہیں ہو سکا۔ دوبارہ سائن اِن کریں۔",
                                        "Your saved session could not be restored. Please sign in again."));
                            }
                            return;
                        }

                        JSONObject payload = NativeApi.json(result.body);
                        String refreshedAccessToken = payload.optString("access_token", "");
                        String refreshedToken = payload.optString("refresh_token", "");
                        if (refreshedAccessToken.length() < 20 || refreshedToken.isEmpty()) {
                            clearRememberedSession();
                            accessToken = "";
                            authSession = null;
                            showLogin();
                            return;
                        }

                        accessToken = refreshedAccessToken;
                        authSession = payload;
                        persistRememberedSession();
                        bootstrap(loginError, true);
                    });
        } catch (Exception ignored) {
            showLogin();
            if (loginError != null) {
                loginError.setText(tr(
                        "سیشن بحال نہیں ہو سکا۔ دوبارہ سائن اِن کریں۔",
                        "Your saved session could not be restored. Please sign in again."));
            }
        }
    }

    private void setEnglishMode(boolean enabled) {
        getPreferences(Context.MODE_PRIVATE).edit()
                .putBoolean("language_english", enabled)
                .apply();
        if (accessToken.isEmpty()) {
            showLogin();
        } else {
            showWorkspace();
            loadRoleData();
        }
    }

    private void chooseLanguage() {
        boolean english = englishMode();
        String[] options = english
                ? new String[]{"English", "Urdu"}
                : new String[]{"اردو", "English"};
        new AlertDialog.Builder(this)
                .setTitle(tr("زبان منتخب کریں", "Choose language"))
                .setSingleChoiceItems(options, english ? 0 : 0, (dialog, which) -> {
                    dialog.dismiss();
                    setEnglishMode(english ? which == 0 : which == 1);
                })
                .setNegativeButton(tr("منسوخ", "Cancel"), null)
                .show();
    }

    private TextView languageToggle(boolean english) {
        TextView toggle = tv(english ? "Urdu" : "English", 12, GREEN_DARK, true);
        toggle.setGravity(Gravity.CENTER);
        toggle.setPadding(dp(14), dp(9), dp(14), dp(9));
        toggle.setMinHeight(dp(48));
        toggle.setBackground(interactiveRounded(
                Color.WHITE, GREEN_SOFT, GREEN, 30));
        toggle.setClickable(true);
        toggle.setFocusable(true);
        toggle.setContentDescription(english ? "Switch to Urdu" : "Switch to English");
        toggle.setOnClickListener(v -> setEnglishMode(!english));
        return toggle;
    }

    private TextView tv(String value, float sp, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sp);
        view.setTextColor(color);
        view.setTypeface(Typeface.create("sans-serif", bold ? Typeface.BOLD : Typeface.NORMAL));
        view.setGravity(Gravity.CENTER_VERTICAL);
        view.setIncludeFontPadding(false);
        return view;
    }
    private GradientDrawable rounded(int fill, int stroke, float radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill);
        if (stroke != 0) drawable.setStroke(dp(1), stroke);
        drawable.setCornerRadius(dp(radiusDp));
        return drawable;
    }

    private StateListDrawable interactiveRounded(
            int normalFill,
            int pressedFill,
            int stroke,
            float radiusDp
    ) {
        StateListDrawable states = new StateListDrawable();
        states.addState(
                new int[]{android.R.attr.state_pressed},
                rounded(pressedFill, stroke, radiusDp));
        states.addState(
                new int[]{android.R.attr.state_focused},
                rounded(pressedFill, stroke, radiusDp));
        states.addState(
                new int[]{},
                rounded(normalFill, stroke, radiusDp));
        return states;
    }

    private ImageView iconBubbleIcon(int resourceId, int fill, int tint) {
        ImageView icon = new ImageView(this);
        icon.setImageResource(resourceId);
        icon.setColorFilter(tint);
        icon.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        icon.setPadding(dp(8), dp(8), dp(8), dp(8));
        icon.setBackground(rounded(fill, 0, 12));
        icon.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        return icon;
    }

    private int moduleIcon(String path) {
        if ("home".equals(path)) return R.drawable.il_icon_home;
        if ("talaba".equals(path) || "students".equals(path)
                || "ustadh".equals(path) || "staff".equals(path)
                || "my-students".equals(path) || "portals".equals(path)) {
            return R.drawable.il_icon_people;
        }
        if ("attendance".equals(path) || "staff/attendance".equals(path)
                || "exams".equals(path)) {
            return R.drawable.il_icon_check;
        }
        if ("hostel".equals(path)) return R.drawable.il_icon_people;
        if ("hifz".equals(path) || "quran".equals(path)
                || "quran/revision".equals(path) || "academics".equals(path)
                || "programs".equals(path) || "people-academics".equals(path)) {
            return R.drawable.il_icon_book;
        }
        if ("documents".equals(path) || "admissions".equals(path)
                || "admission-new".equals(path) || "reports".equals(path)) {
            return R.drawable.il_icon_document;
        }
        if ("settings".equals(path)) return R.drawable.il_icon_settings;
        if ("logout".equals(path)) return R.drawable.il_icon_logout;
        return R.drawable.il_icon_more;
    }

    private void updateNavSelection() {
        if (bottomNav == null) return;
        for (int i = 0; i < bottomNav.getChildCount(); i++) {
            View child = bottomNav.getChildAt(i);
            String screen = String.valueOf(child.getTag());
            boolean selected = currentScreen.equals(screen);
            child.setSelected(selected);
            child.setBackground(rounded(
                    selected ? GREEN_SOFT : Color.TRANSPARENT,
                    0,
                    15));
            if (child instanceof LinearLayout) {
                LinearLayout childLayout = (LinearLayout) child;
                if (childLayout.getChildCount() > 0) {
                    View icon = childLayout.getChildAt(0);
                    if (icon instanceof ImageView) {
                        icon.setBackground(rounded(
                                selected ? GREEN : MINT,
                                0,
                                12));
                        ((ImageView) icon).setColorFilter(
                                selected ? Color.WHITE : GREEN_DARK);
                    }
                    if (childLayout.getChildCount() > 1
                            && childLayout.getChildAt(1) instanceof TextView) {
                        ((TextView) childLayout.getChildAt(1)).setTextColor(
                                selected ? GREEN_DARK : MUTED);
                    }
                }
            }
        }
    }

    private LinearLayout card() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(18), dp(16), dp(18), dp(16));
        card.setBackground(rounded(Color.WHITE, BORDER, 18));
        card.setElevation(dp(2));
        return card;
    }

    private GradientDrawable gradient(int start, int end, float radiusDp) {
        GradientDrawable drawable = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                new int[]{start, end});
        drawable.setCornerRadius(dp(radiusDp));
        return drawable;
    }

    private TextView iconBubble(String glyph, int fill, int color) {
        TextView icon = tv(glyph, 18, color, true);
        icon.setGravity(Gravity.CENTER);
        icon.setBackground(rounded(fill, 0, 14));
        return icon;
    }

    private LinearLayout row() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        return row;
    }

    private void margin(View view, int l, int t, int r, int b) {
        if (view.getLayoutParams() == null) return;
        LinearLayout.LayoutParams params = (LinearLayout.LayoutParams) view.getLayoutParams();
        params.setMargins(dp(l), dp(t), dp(r), dp(b));
        view.setLayoutParams(params);
    }

    private void addGap(LinearLayout parent, int heightDp) {
        parent.addView(new View(this),
                new LinearLayout.LayoutParams(1, dp(heightDp)));
    }
    private TextView pill(String label, int background, int color) {
        TextView pill = tv(label, 12, color, true);
        pill.setGravity(Gravity.CENTER);
        pill.setPadding(dp(12), dp(8), dp(12), dp(8));
        pill.setBackground(rounded(background, BORDER, 30));
        LinearLayout.LayoutParams params =
                new LinearLayout.LayoutParams(-2, -2);
        params.setMargins(0, 0, dp(6), 0);
        pill.setLayoutParams(params);
        return pill;
    }

    private Button primaryButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextSize(15);
        button.setTextColor(Color.WHITE);
        button.setAllCaps(false);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setGravity(Gravity.CENTER);
        button.setPadding(dp(16), dp(8), dp(16), dp(8));
        button.setMinHeight(dp(48));
        button.setBackground(interactiveRounded(GREEN, GREEN_DARK, GREEN_DARK, 14));
        return button;
    }

    private EditText field(String hint) {
        EditText field = new EditText(this);
        field.setHint(hint);
        field.setTextSize(15);
        field.setTextColor(TEXT);
        field.setHintTextColor(MUTED);
        field.setSingleLine(true);
        field.setPadding(dp(14), 0, dp(14), 0);
        field.setBackground(rounded(Color.rgb(251, 252, 251), BORDER, 12));
        return field;
    }
    private void showLogin() {
        sessionGeneration++;
        accessToken = "";
        authSession = null;
        tenantId = 0;
        branchId = 0;
        surface = "admin";
        guardianPayload = null;
        parentChildren = 0;
        currentScreen = "home";
        root.removeAllViews();
        boolean english = englishMode();
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(BG);
        root.addView(scroll, new FrameLayout.LayoutParams(-1, -1));

        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(18), dp(18), dp(18), dp(26));
        page.setLayoutDirection(english
                ? View.LAYOUT_DIRECTION_LTR
                : View.LAYOUT_DIRECTION_RTL);
        scroll.addView(page);

        LinearLayout languageRow = row();
        languageRow.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        languageRow.setGravity(Gravity.CENTER_VERTICAL);
        TextView languageLabel = tv(
                english ? "Language" : "زبان",
                12, MUTED, true);
        languageRow.addView(languageLabel,
                new LinearLayout.LayoutParams(0, -2, 1f));
        languageRow.addView(languageToggle(english),
                new LinearLayout.LayoutParams(-2, -2));
        page.addView(languageRow, new LinearLayout.LayoutParams(-1, -2));
        addGap(page, 10);

        View stripe = new View(this);
        GradientDrawable stripeBg = new GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                new int[]{GREEN_DARK, GREEN});
        stripe.setBackground(stripeBg);
        page.addView(stripe, new LinearLayout.LayoutParams(-1, dp(4)));
        addGap(page, 14);

        LinearLayout brand = card();
        brand.setPadding(dp(18), dp(18), dp(18), dp(18));
        page.addView(brand, new LinearLayout.LayoutParams(-1, -2));
        LinearLayout markRow = row();
        markRow.setLayoutDirection(english
                ? View.LAYOUT_DIRECTION_LTR
                : View.LAYOUT_DIRECTION_RTL);
        brand.addView(markRow, new LinearLayout.LayoutParams(-1, -2));

        TextView mark = tv(english ? "JI" : "ج", 22, Color.WHITE, true);
        mark.setGravity(Gravity.CENTER);
        mark.setBackground(rounded(GREEN, GREEN, 12));
        markRow.addView(mark, new LinearLayout.LayoutParams(dp(54), dp(54)));

        LinearLayout brandCopy = new LinearLayout(this);
        brandCopy.setOrientation(LinearLayout.VERTICAL);
        brandCopy.setPadding(
                english ? dp(12) : 0, 0,
                english ? 0 : dp(12), 0);
        markRow.addView(brandCopy,
                new LinearLayout.LayoutParams(0, -2, 1f));

        TextView small = tv(
                tr(ClientConfig.SHORT_NAME_UR, "Jamia Islamia"),
                13, MUTED, true);
        brandCopy.addView(small);
        TextView name = tv(
                tr(ClientConfig.INSTITUTION_UR, ClientConfig.INSTITUTION),
                23, GREEN_DARK, true);
        name.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        brandCopy.addView(name, new LinearLayout.LayoutParams(-1, -2));

        addGap(brand, 12);
        TextView descriptor = tv(
                tr(ClientConfig.DESCRIPTOR_UR, "Hifz • Arabic Education • Residential Hostel"),
                14, MUTED, false);
        descriptor.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        brand.addView(descriptor);
        LinearLayout chips = row();
        chips.setLayoutDirection(english
                ? View.LAYOUT_DIRECTION_LTR
                : View.LAYOUT_DIRECTION_RTL);
        brand.addView(chips, new LinearLayout.LayoutParams(-1, -2));
        TextView c1 = pill(tr("طلبہ", "Students"), GREEN_SOFT, GREEN_DARK);
        TextView c2 = pill(tr("حفظ", "Hifz"), GREEN_SOFT, GREEN_DARK);
        TextView c3 = pill(tr("ہاسٹل", "Hostel"), GREEN_SOFT, GREEN_DARK);
        chips.addView(c1);
        chips.addView(c2);
        chips.addView(c3);

        TextView director = tv(
                ClientConfig.DIRECTOR + "  •  " + ClientConfig.PHONE,
                12, MUTED, false);
        director.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        LinearLayout.LayoutParams directorParams =
                new LinearLayout.LayoutParams(-1, -2);
        directorParams.topMargin = dp(12);
        brand.addView(director, directorParams);

        addGap(page, 12);
        LinearLayout form = card();
        page.addView(form, new LinearLayout.LayoutParams(-1, -2));

        TextView title = tv(tr("سائن اِن", "Sign in"), 26, TEXT, true);
        title.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        form.addView(title);
        TextView subtitle = tv(
                tr("جامعہ کے محفوظ ورک اسپیس میں داخل ہوں",
                        "Enter your secure Jamia workspace"),
                13, MUTED, false);
        subtitle.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        form.addView(subtitle);
        addGap(form, 12);
        EditText email = field(tr("ای میل", "Email"));
        email.setTextDirection(View.TEXT_DIRECTION_LTR);
        email.setInputType(InputType.TYPE_CLASS_TEXT |
                InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        form.addView(email, new LinearLayout.LayoutParams(-1, dp(54)));

        addGap(form, 10);
        EditText password = field(tr("پاس ورڈ", "Password"));
        password.setTextDirection(View.TEXT_DIRECTION_LTR);
        password.setInputType(InputType.TYPE_CLASS_TEXT |
                InputType.TYPE_TEXT_VARIATION_PASSWORD);
        form.addView(password, new LinearLayout.LayoutParams(-1, dp(54)));

        addGap(form, 5);
        LinearLayout rememberRow = row();
        rememberRow.setGravity(Gravity.CENTER_VERTICAL);
        rememberRow.setLayoutDirection(english
                ? View.LAYOUT_DIRECTION_LTR
                : View.LAYOUT_DIRECTION_RTL);
        rememberMeToggle = new CheckBox(this);
        rememberMeToggle.setText(tr("مجھے یاد رکھیں", "Remember me"));
        rememberMeToggle.setTextSize(13);
        rememberMeToggle.setTextColor(TEXT);
        rememberRow.addView(rememberMeToggle, new LinearLayout.LayoutParams(-1, -2));
        form.addView(rememberRow, new LinearLayout.LayoutParams(-1, -2));

        addGap(form, 9);
        signInButton = primaryButton(tr("سائن اِن", "Sign in"));
        form.addView(signInButton, new LinearLayout.LayoutParams(-1, dp(54)));

        TextView error = tv("", 12, Color.rgb(177, 45, 45), true);
        loginError = error;
        error.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        LinearLayout.LayoutParams errorParams =
                new LinearLayout.LayoutParams(-1, -2);
        errorParams.topMargin = dp(10);
        form.addView(error, errorParams);

        TextView help = tv(
                tr("جامعہ • 2026–2027 • اردو ورک اسپیس",
                        "Jamia • 2026–2027 • English workspace"),
                11, MUTED, false);
        help.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        LinearLayout.LayoutParams helpParams =
                new LinearLayout.LayoutParams(-1, -2);
        helpParams.topMargin = dp(14);
        form.addView(help, helpParams);
        signInButton.setOnClickListener(v -> {
            String emailValue = email.getText().toString().trim();
            String passwordValue = password.getText().toString();
            boolean rememberSession = rememberMeToggle != null && rememberMeToggle.isChecked();
            if (emailValue.isEmpty() || passwordValue.isEmpty()) {
                error.setText(tr("ای میل اور پاس ورڈ درج کریں۔",
                        "Enter your email and password."));
                return;
            }

            clearRememberedSession();
            signInButton.setEnabled(false);
            signInButton.setText(tr("چیک ہو رہا ہے…", "Checking…"));
            error.setText("");

            try {
                JSONObject body = new JSONObject();
                body.put("email", emailValue);
                body.put("password", passwordValue);

                NativeApi.postJson(
                        ClientConfig.API_BASE + "/api/mobile/auth",
                        body.toString(),
                        null,
                        result -> {
                            if (!result.ok()) {
                                signInButton.setEnabled(true);
                                signInButton.setText(tr("سائن اِن", "Sign in"));
                                error.setText(authError(result));
                                return;
                            }
                            JSONObject payload = NativeApi.json(result.body);
                            accessToken = payload.optString("access_token", "");
                            authSession = payload;
                            if (accessToken.length() < 20) {
                                signInButton.setEnabled(true);
                                signInButton.setText(tr("سائن اِن", "Sign in"));
                                error.setText(tr("سائن اِن مکمل نہیں ہو سکا۔", "Sign-in could not be completed."));
                                return;
                            }
                            bootstrap(error, rememberSession);
                        });
            } catch (Exception exception) {
                signInButton.setEnabled(true);
                signInButton.setText(tr("سائن اِن", "Sign in"));
                error.setText(tr("درخواست تیار نہیں ہو سکی۔", "The request could not be prepared."));
            }
        });
    }

    private String authError(NativeApi.Result result) {
        if (result.status == 400 || result.status == 401) {
            return tr("ای میل یا پاس ورڈ درست نہیں ہے.",
                    "The email or password is incorrect.");
        }
        if (result.status == 0) return tr("انٹرنیٹ کنکشن دستیاب نہیں۔",
                "No internet connection is available.");
        return tr("سائن اِن سروس ابھی دستیاب نہیں۔",
                "The sign-in service is currently unavailable.");
    }
    private void bootstrap(TextView error, boolean rememberSession) {
        final long requestGeneration = sessionGeneration;
        final String requestAccessToken = accessToken;
        NativeApi.get(
                ClientConfig.API_BASE + "/api/mobile/bootstrap",
                requestAccessToken,
                result -> {
                    if (requestGeneration != sessionGeneration) return;

                    if (!result.ok()) {
                        if (rememberSession && (result.status == 400 || result.status == 401)) {
                            clearRememberedSession();
                        }
                        accessToken = "";
                        authSession = null;
                        signInButton.setEnabled(true);
                        signInButton.setText(tr("سائن اِن", "Sign in"));
                        error.setText(result.status == 401
                                ? tr("اس اکاؤنٹ کی ورک اسپیس اجازت موجود نہیں۔",
                                        "This account has no workspace access.")
                                : tr("ورک اسپیس کی معلومات حاصل نہیں ہو سکیں۔",
                                        "Workspace information could not be loaded."));
                        return;
                    }

                    JSONObject payload = NativeApi.json(result.body);
                    JSONArray workspaces = payload.optJSONArray("workspaces");
                    JSONObject chosen = null;
                    String fallbackSurface = "admin";
                    if (workspaces != null) {
                        for (int i = 0; i < workspaces.length(); i++) {
                            JSONObject workspace = workspaces.optJSONObject(i);
                            if (workspace == null) continue;
                            String candidate = workspace.optString("surface", "");
                            if ("admin".equals(candidate)) {
                                chosen = workspace;
                                break;
                            }
                            if (chosen == null &&
                                    ("teacher".equals(candidate) || "parent".equals(candidate))) {
                                chosen = workspace;
                                fallbackSurface = candidate;
                            }
                        }
                    }

                    if (chosen == null) {
                        if (rememberSession) clearRememberedSession();
                        signInButton.setEnabled(true);
                        signInButton.setText(tr("سائن اِن", "Sign in"));
                        error.setText(tr("اس اکاؤنٹ کے لیے فعال ورک اسپیس نہیں ہے۔",
                                "This account has no active workspace."));
                        return;
                    }

                    surface = chosen.optString("surface", fallbackSurface);
                    tenantId = chosen.optInt("tenantId", 0);
                    branchId = chosen.optInt("branchId", 0);
                    if (rememberSession) persistRememberedSession();
                    else clearRememberedSession();
                    showWorkspace();
                    loadRoleData();
                });
    }
    private void showWorkspace() {
        root.removeAllViews();
        boolean english = englishMode();

        LinearLayout outer = new LinearLayout(this);
        outer.setOrientation(LinearLayout.VERTICAL);
        outer.setBackgroundColor(BG);
        root.addView(outer, new FrameLayout.LayoutParams(-1, -1));

        LinearLayout header = row();
        header.setPadding(dp(14), dp(10), dp(14), dp(10));
        header.setBackground(rounded(Color.WHITE, BORDER, 0));
        header.setLayoutDirection(english
                ? View.LAYOUT_DIRECTION_LTR
                : View.LAYOUT_DIRECTION_RTL);
        header.setElevation(dp(4));
        outer.addView(header, new LinearLayout.LayoutParams(-1, dp(78)));

        TextView headerMark = tv(english ? "JI" : "ج", 18, Color.WHITE, true);
        headerMark.setGravity(Gravity.CENTER);
        headerMark.setBackground(gradient(GREEN, GREEN_DARK, 14));
        header.addView(headerMark, new LinearLayout.LayoutParams(dp(46), dp(46)));

        LinearLayout headerCopy = new LinearLayout(this);
        headerCopy.setOrientation(LinearLayout.VERTICAL);
        headerCopy.setPadding(dp(11), 0, dp(10), 0);
        header.addView(headerCopy, new LinearLayout.LayoutParams(0, -2, 1f));

        headerTitle = tv(tr(ClientConfig.SHORT_NAME_UR, "Jamia Islamia"), 16, TEXT, true);
        headerTitle.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        headerCopy.addView(headerTitle);

        headerMeta = tv(
                ClientConfig.BRANCH + "  •  " + ClientConfig.ACADEMIC_YEAR +
                        "  •  " + roleLabel(),
                10, MUTED, false);
        headerMeta.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        LinearLayout.LayoutParams metaParams = new LinearLayout.LayoutParams(-1, -2);
        metaParams.topMargin = dp(3);
        headerCopy.addView(headerMeta, metaParams);

        LinearLayout headerActions = row();
        headerActions.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        headerActions.setGravity(Gravity.CENTER_VERTICAL);
        TextView language = languageToggle(english);
        LinearLayout.LayoutParams languageParams = new LinearLayout.LayoutParams(-2, dp(40));
        languageParams.setMargins(dp(5), 0, dp(5), 0);
        headerActions.addView(language, languageParams);

        connectionState = tv(english ? "Loading" : "لوڈ…", 9, GREEN_DARK, true);
        connectionState.setGravity(Gravity.CENTER);
        connectionState.setPadding(dp(10), dp(7), dp(10), dp(7));
        connectionState.setBackground(rounded(GREEN_SOFT, 0, 30));
        headerActions.addView(connectionState, new LinearLayout.LayoutParams(dp(70), dp(38)));
        header.addView(headerActions, new LinearLayout.LayoutParams(-2, -2));

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        outer.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1f));

        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(16), dp(18), dp(16), dp(28));
        content.setLayoutDirection(englishMode()
                ? View.LAYOUT_DIRECTION_LTR
                : View.LAYOUT_DIRECTION_RTL);
        scroll.addView(content);

        LinearLayout nav = row();
        nav.setPadding(dp(7), dp(6), dp(7), dp(8));
        nav.setBackground(rounded(Color.WHITE, BORDER, 0));
        nav.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        nav.setElevation(dp(8));
        bottomNav = nav;
        outer.addView(nav, new LinearLayout.LayoutParams(-1, dp(78)));

        navItem(nav, tr("ہوم", "Home"), "home");
        navItem(nav, tr("طلبہ", "Students"), "talaba");
        navItem(nav, tr("حاضری", "Attendance"), "attendance");
        if ("parent".equals(surface)) {
            navItem(nav, tr("حفظ", "Hifz"), "hifz");
        } else {
            navItem(nav, tr("ہاسٹل", "Hostel"), "hostel");
        }
        navItem(nav, tr("مزید", "More"), "more");

        showScreen("home");
    }

    private int navIcon(String screen) {
        return moduleIcon(screen);
    }

    private void navItem(LinearLayout nav, String label, String screen) {
        LinearLayout item = new LinearLayout(this);
        item.setOrientation(LinearLayout.VERTICAL);
        item.setGravity(Gravity.CENTER);
        item.setPadding(dp(4), dp(4), dp(4), dp(4));
        item.setBackground(rounded(Color.TRANSPARENT, 0, 15));
        item.setClickable(true);
        item.setFocusable(true);
        item.setSelected("home".equals(screen));
        item.setTag(screen);
        item.setContentDescription(label);
        item.setOnClickListener(v -> showScreen(screen));

        ImageView icon = iconBubbleIcon(navIcon(screen), MINT, GREEN_DARK);
        item.addView(icon, new LinearLayout.LayoutParams(dp(38), dp(38)));

        TextView caption = tv(label, 10, MUTED, true);
        caption.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams captionParams = new LinearLayout.LayoutParams(-1, dp(24));
        captionParams.topMargin = dp(2);
        item.addView(caption, captionParams);

        nav.addView(item, new LinearLayout.LayoutParams(0, -1, 1f));
    }

    private String roleLabel() {
        if ("teacher".equals(surface)) return tr("استاد", "Teacher");
        if ("parent".equals(surface)) return tr("گارڈین", "Guardian");
        return tr("آفس", "Office");
    }

    private void handleNativeAction(String path) {
        if ("admission-new".equals(path)) {
            renderAdmissionForm();
            return;
        }
        if ("admissions".equals(path)) {
            showScreen("admissions");
            return;
        }
        if ("students".equals(path)) {
            showScreen("talaba");
            return;
        }
        if ("programs".equals(path) || "people-academics".equals(path)) {
            showScreen("academics");
            return;
        }
        if ("attendance".equals(path) || "staff/attendance".equals(path)) {
            showScreen("attendance");
            return;
        }
        if ("hostel".equals(path)) {
            showScreen("hostel");
            return;
        }
        if ("hostel-add".equals(path)) {
            showHostelAddDialog();
            return;
        }
        if ("quran".equals(path) || "quran/revision".equals(path)) {
            showScreen("hifz");
            return;
        }
        if ("exams".equals(path)) {
            showScreen("exams");
            return;
        }
        if ("documents".equals(path) || "students/id-cards".equals(path)) {
            showScreen("documents");
            return;
        }
        if ("staff".equals(path)
                || "staff/leave".equals(path)
                || "my-students".equals(path)) {
            showScreen("ustadh");
            return;
        }
        if ("reports".equals(path)) {
            showScreen("reports");
            return;
        }
        if ("portals".equals(path)) {
            showScreen("portals");
            return;
        }
        if ("settings".equals(path)) {
            showScreen("settings");
            return;
        }
        if ("logout".equals(path)) {
            showScreen("logout");
            return;
        }

        new AlertDialog.Builder(this)
                .setTitle(tr("یہ کارروائی دستیاب نہیں", "Action unavailable"))
                .setMessage(tr(
                        "یہ native workflow ابھی دستیاب نہیں ہے۔",
                        "This native workflow is not available yet."))
                .setPositiveButton(tr("ٹھیک ہے", "OK"), null)
                .show();
    }

    private void setHostelResidenceNative(int personId, String residenceType) {
        if (personId <= 0 || accessToken.isEmpty()) return;
        try {
            JSONObject body = new JSONObject();
            body.put("studentPersonId", personId);
            body.put("residenceType", residenceType);
            body.put("reason", "Updated from Hostel Boys workspace");

            String url = ClientConfig.API_BASE +
                    "/api/mobile/hostel?tenantId=" + tenantId + "&branchId=" + branchId;
            NativeApi.postJsonWithBearer(url, body.toString(), accessToken, result -> {
                if (!result.ok()) {
                    new AlertDialog.Builder(this)
                            .setTitle(tr("ہاسٹل اپ ڈیٹ نہیں ہو سکا", "Hostel update failed"))
                            .setMessage(tr(
                                    "رہائشی حیثیت تبدیل نہیں ہو سکی۔",
                                    "The student's residence status could not be updated."))
                            .setPositiveButton(tr("ٹھیک ہے", "OK"), null)
                            .show();
                    return;
                }
                renderHostel();
            });
        } catch (Exception ignored) {
            new AlertDialog.Builder(this)
                    .setTitle(tr("ہاسٹل اپ ڈیٹ نہیں ہو سکا", "Hostel update failed"))
                    .setPositiveButton(tr("ٹھیک ہے", "OK"), null)
                    .show();
        }
    }

    private void showHostelAddDialog() {
        String url = ClientConfig.API_BASE +
                "/api/mobile/hostel?tenantId=" + tenantId + "&branchId=" + branchId;
        NativeApi.get(url, accessToken, result -> {
            if (!result.ok()) {
                new AlertDialog.Builder(this)
                        .setTitle(tr("طلبہ دستیاب نہیں", "Students unavailable"))
                        .setPositiveButton(tr("ٹھیک ہے", "OK"), null)
                        .show();
                return;
            }

            JSONObject center = NativeApi.json(result.body).optJSONObject("center");
            JSONArray available = center == null ? null : center.optJSONArray("available_students");
            if (available == null || available.length() == 0) {
                new AlertDialog.Builder(this)
                        .setTitle(tr("کوئی ڈے اسٹوڈنٹ نہیں", "No day students"))
                        .setMessage(tr(
                                "نئے طالب علم کو پہلے Students میں بنائیں۔",
                                "Create the student in Students first."))
                        .setPositiveButton(tr("ٹھیک ہے", "OK"), null)
                        .show();
                return;
            }

            String[] labels = new String[available.length()];
            int[] personIds = new int[available.length()];
            for (int i = 0; i < available.length(); i++) {
                JSONObject student = available.optJSONObject(i);
                if (student == null) continue;
                personIds[i] = student.optInt("person_id", 0);
                String program = englishMode()
                        ? student.optString("program_label", "Program")
                        : student.optString("program_label_ur", student.optString("program_label", "پروگرام"));
                String group = englishMode()
                        ? student.optString("group_label", "—")
                        : student.optString("group_label_ur", student.optString("group_label", "—"));
                labels[i] = student.optString("display_name", "Student") +
                        "  •  " + program + "  •  " + group;
            }

            new AlertDialog.Builder(this)
                    .setTitle(tr("موجودہ طالب علم شامل کریں", "Add existing student"))
                    .setItems(labels, (dialog, which) -> {
                        int personId = personIds[which];
                        if (personId > 0) {
                            setHostelResidenceNative(personId, "hostel");
                        }
                    })
                    .setNegativeButton(tr("منسوخ", "Cancel"), null)
                    .show();
        });
    }

    private void showScreen(String screen) {
        if (content == null) return;
        currentScreen = screen;
        updateNavSelection();
        content.removeAllViews();

        if ("home".equals(screen)) {
            headerTitle.setText(englishMode()
                    ? "Jamia Islamia"
                    : ClientConfig.SHORT_NAME_UR);
            renderHome();
            return;
        }

        if ("talaba".equals(screen)) {
            if ("parent".equals(surface)) renderGuardianChildren();
            else renderTalaba();
        } else if ("attendance".equals(screen)) {
            if ("parent".equals(surface)) renderGuardianAttendance();
            else renderAttendance();
        } else if ("hostel".equals(screen)) renderHostel();
        else if ("more".equals(screen)) {
            if ("parent".equals(surface)) renderGuardianMore();
            else renderMore();
        }
        else if ("admissions".equals(screen)) renderAdmissions();
        else if ("academics".equals(screen)) renderAcademics();
        else if ("hifz".equals(screen)) {
            if ("parent".equals(surface)) renderGuardianHifz();
            else renderHifz();
        }
        else if ("exams".equals(screen)) renderExams();
        else if ("documents".equals(screen)) renderDocuments();
        else if ("portals".equals(screen)) renderPortals();
        else if ("ustadh".equals(screen)) renderUstadh();
        else if ("reports".equals(screen)) renderReports();
        else if ("settings".equals(screen)) renderSettings();
        else if ("logout".equals(screen)) {
            clearRememberedSession();
            showLogin();
        }
    }

    private void titleBlock(String title, String subtitle) {
        boolean english = englishMode();
        headerTitle.setText(title);
        TextView h = tv(title, 27, TEXT, true);
        h.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        content.addView(h);

        TextView s = tv(subtitle, 12, MUTED, false);
        s.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        LinearLayout.LayoutParams params =
                new LinearLayout.LayoutParams(-1, -2);
        params.topMargin = dp(5);
        content.addView(s, params);

        addGap(content, 12);
    }
    private void sectionLabel(String text) {
        TextView view = tv(text, 14, GREEN_DARK, true);
        view.setGravity(englishMode() ? Gravity.LEFT : Gravity.RIGHT);
        LinearLayout.LayoutParams params =
                new LinearLayout.LayoutParams(-1, -2);
        params.topMargin = dp(8);
        params.bottomMargin = dp(8);
        content.addView(view, params);
    }

    private LinearLayout metricCard(String label, String value, int fill, int valueColor) {
        boolean english = englishMode();
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(15), dp(14), dp(15), dp(14));
        card.setBackground(rounded(fill, fill == Color.WHITE ? BORDER : 0, 17));
        card.setElevation(dp(1));

        TextView small = tv(label, 10,
                fill == Color.WHITE ? MUTED : Color.rgb(205, 238, 222), true);
        small.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        card.addView(small);

        TextView large = tv(value, 24, valueColor, true);
        large.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        LinearLayout.LayoutParams params =
                new LinearLayout.LayoutParams(-1, -2);
        params.topMargin = dp(5);
        card.addView(large, params);
        return card;
    }

    private void addMetricRow(String l1, String v1, String l2, String v2,
                              boolean primaryFirst) {
        LinearLayout line = row();
        content.addView(line, new LinearLayout.LayoutParams(-1, -2));

        LinearLayout first = metricCard(l1, v1,
                primaryFirst ? GREEN : Color.WHITE,
                primaryFirst ? Color.WHITE : GREEN_DARK);
        LinearLayout second = metricCard(l2, v2, Color.WHITE, GREEN_DARK);

        LinearLayout.LayoutParams p1 = new LinearLayout.LayoutParams(0, -2, 1f);
        LinearLayout.LayoutParams p2 = new LinearLayout.LayoutParams(0, -2, 1f);
        p1.setMargins(0, 0, dp(6), 0);
        p2.setMargins(dp(6), 0, 0, 0);
        line.addView(first, p1);
        line.addView(second, p2);
        addGap(content, 8);
    }
    private LinearLayout workspaceLink(String label, String subtitle, String screen) {
        boolean english = englishMode();
        LinearLayout link = row();
        link.setGravity(Gravity.CENTER_VERTICAL);
        link.setPadding(dp(13), dp(12), dp(10), dp(12));
        link.setLayoutDirection(english
                ? View.LAYOUT_DIRECTION_LTR
                : View.LAYOUT_DIRECTION_RTL);
        link.setBackground(interactiveRounded(Color.WHITE, GREEN_SOFT, BORDER, 17));
        link.setElevation(dp(1));
        link.setClickable(true);
        link.setFocusable(true);
        link.setContentDescription(label);
        link.setOnClickListener(v -> showScreen(screen));

        ImageView bubble = iconBubbleIcon(moduleIcon(screen), GREEN_SOFT, GREEN_DARK);
        link.addView(bubble, new LinearLayout.LayoutParams(dp(40), dp(40)));

        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.setPadding(dp(10), 0, dp(7), 0);
        link.addView(copy, new LinearLayout.LayoutParams(0, -2, 1f));

        TextView title = tv(label, 14, TEXT, true);
        title.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        copy.addView(title);

        TextView detail = tv(subtitle, 10, MUTED, false);
        detail.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        LinearLayout.LayoutParams detailParams = new LinearLayout.LayoutParams(-1, -2);
        detailParams.topMargin = dp(4);
        copy.addView(detail, detailParams);

        ImageView arrow = new ImageView(this);
        arrow.setImageResource(R.drawable.il_icon_chevron);
        arrow.setColorFilter(GREEN_DARK);
        arrow.setScaleType(ImageView.ScaleType.CENTER);
        arrow.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        link.addView(arrow, new LinearLayout.LayoutParams(dp(38), dp(40)));

        return link;
    }

    private void addTwoLinks(String label1, String sub1, String screen1,
                             String label2, String sub2, String screen2) {
        LinearLayout line = row();
        line.setLayoutDirection(englishMode()
                ? View.LAYOUT_DIRECTION_LTR
                : View.LAYOUT_DIRECTION_RTL);
        LinearLayout one = workspaceLink(label1, sub1, screen1);
        LinearLayout two = workspaceLink(label2, sub2, screen2);

        LinearLayout.LayoutParams p1 = new LinearLayout.LayoutParams(0, dp(86), 1f);
        LinearLayout.LayoutParams p2 = new LinearLayout.LayoutParams(0, dp(86), 1f);
        p1.setMargins(0, 0, dp(5), 0);
        p2.setMargins(dp(5), 0, 0, 0);
        line.addView(one, p1);
        line.addView(two, p2);
        content.addView(line);
        addGap(content, 9);
    }
    private void renderHome() {
        if ("parent".equals(surface)) {
            renderGuardianHome();
            return;
        }

        boolean english = englishMode();
        LinearLayout hero = new LinearLayout(this);
        hero.setOrientation(LinearLayout.VERTICAL);
        hero.setPadding(dp(20), dp(20), dp(20), dp(20));
        hero.setBackground(gradient(GREEN_DARK, GREEN, 24));
        hero.setElevation(dp(4));

        TextView kicker = tv(
                tr("آج کا ورک اسپیس", "TODAY'S WORKSPACE") +
                        "  •  " + roleLabel(),
                10, Color.rgb(193, 233, 212), true);
        kicker.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        hero.addView(kicker);

        TextView name = tv(
                tr("جامعہ اسلامیہ علوم القرآن", "Jamia Islamia Uloomul Quraan"),
                24, Color.WHITE, true);
        name.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        LinearLayout.LayoutParams nameParams = new LinearLayout.LayoutParams(-1, -2);
        nameParams.topMargin = dp(7);
        hero.addView(name, nameParams);

        TextView desc = tv(
                tr("حفظ، عربی، طلبہ، حاضری اور رہائشی ہاسٹل ایک جگہ",
                        "Hifz, Arabic, students, attendance and hostel in one workspace"),
                11, Color.rgb(221, 240, 230), false);
        desc.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        LinearLayout.LayoutParams descParams = new LinearLayout.LayoutParams(-1, -2);
        descParams.topMargin = dp(7);
        hero.addView(desc, descParams);

        TextView year = tv(
                ClientConfig.BRANCH + "  •  " + ClientConfig.ACADEMIC_YEAR,
                10, Color.rgb(190, 222, 207), false);
        year.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        LinearLayout.LayoutParams yearParams = new LinearLayout.LayoutParams(-1, -2);
        yearParams.topMargin = dp(12);
        hero.addView(year, yearParams);

        content.addView(hero);
        addGap(content, 14);

        sectionLabel(tr("آج کا خلاصہ", "AT A GLANCE"));
        addMetricRow(tr("فعال طلبہ", "Active Talaba"), liveStudents,
                tr("اساتذہ", "Ustadh"), liveStaff, true);
        addMetricRow(tr("آج کی حاضری", "Today's attendance"), liveAttendance,
                tr("اوپن داخلے", "Open admissions"), liveAdmissions, false);

        sectionLabel(tr("فوری رسائی", "QUICK ACCESS"));
        addTwoLinks(tr("داخلہ", "Admissions"), "New + pending", "admissions",
                tr("طلبہ", "Talaba"), "Register + profiles", "talaba");
        addTwoLinks(tr("حاضری", "Attendance"), "Biometric + daily", "attendance",
                tr("ہاسٹل", "Hostel"), "Programs + hostel boys", "hostel");
        addTwoLinks(tr("قرآن و حفظ", "Qur’an & Hifz"), "Progress", "hifz",
                tr("اکیڈمکس", "Academic"), "Arabic + learning", "academics");
        addTwoLinks(tr("امتحانات", "Exams & results"), "Results", "exams",
                tr("دستاویزات", "Documents"), "IDs + certificates", "documents");
        addTwoLinks(tr("پورٹلز", "Portals"), "Guardian + Ustadh", "portals",
                tr("رپورٹس", "Reports"), "Operational reports", "reports");

    }

    private JSONArray guardianChildren() {
        if (guardianPayload == null) return new JSONArray();
        JSONArray children = guardianPayload.optJSONArray("children");
        return children == null ? new JSONArray() : children;
    }

    private String childDisplay(JSONObject child) {
        String name = child.optString("name", "Talaba").trim();
        if (englishMode()) return name;
        String nativeName = child.optString("nativeName", "").trim();
        return nativeName.isEmpty() ? name : nativeName + "  •  " + name;
    }

    private void renderGuardianHome() {
        titleBlock(tr("گارڈین پورٹل", "Guardian Portal"),
                tr("جامعہ کے Talaba، حاضری اور حفظ کی معلومات",
                        "Students, attendance and Hifz at a glance"));
        addMetricRow(tr("منسلک Talaba", "Linked Talaba"), String.valueOf(parentChildren),
                tr("تعلیمی سال", "Academic year"), ClientConfig.ACADEMIC_YEAR, true);

        sectionLabel(tr("طلبہ کا خلاصہ", "Talaba overview"));
        JSONArray children = guardianChildren();
        for (int i = 0; i < children.length(); i++) {
            JSONObject child = children.optJSONObject(i);
            if (child == null) continue;
            int total = child.optInt("attendanceTotal30d", 0);
            int present = child.optInt("attendancePresent30d", 0);
            addActionCard(childDisplay(child),
                    tr("30-day attendance: ", "30-day attendance: ") + present + " / " + total +
                            "  •  " + (child.optString("enrollmentStatus", "active")));
        }

        JSONObject overview = guardianPayload == null
                ? null : guardianPayload.optJSONObject("overview");
        if (overview != null) {
            JSONArray results = overview.optJSONArray("results");
            if (results != null && results.length() > 0) {
                sectionLabel(tr("حالیہ نتیجہ", "Recent result"));
                JSONObject result = results.optJSONObject(0);
                if (result != null) {
                    addActionCard(
                            result.optString("exam", "Result"),
                            result.optString("studentName", "Talaba") +
                                    "  •  " + result.optString("grade", "—") +
                                    "  •  " + result.optString("status", "—"));
                }
            }
        }
    }

    private void renderGuardianChildren() {
        titleBlock(tr("طلبہ", "Talaba"),
                tr("Guardian Portal • منسلک طلبہ", "Guardian Portal • linked students"));
        JSONArray children = guardianChildren();
        if (children.length() == 0) {
            addActionCard(tr("کوئی منسلک Talaba نہیں", "No linked Talaba"),
                    tr("اس اکاؤنٹ کے ساتھ کوئی طالب علم منسلک نہیں ہے۔",
                            "No student is linked to this account."));
            return;
        }
        for (int i = 0; i < children.length(); i++) {
            JSONObject child = children.optJSONObject(i);
            if (child == null) continue;
            LinearLayout item = card();
            TextView name = tv(childDisplay(child), 17, GREEN_DARK, true);
            name.setGravity(englishMode() ? Gravity.LEFT : Gravity.RIGHT);
            item.addView(name);

            String program = child.optInt("groupId", 0) > 0
                    ? tr("Hifz / Arabic learning group linked",
                            "Hifz / Arabic learning group linked")
                    : tr("Academic profile", "Academic profile");
            TextView meta = tv(program, 11, MUTED, false);
            meta.setGravity(Gravity.RIGHT);
            LinearLayout.LayoutParams metaParams =
                    new LinearLayout.LayoutParams(-1, -2);
            metaParams.topMargin = dp(6);
            item.addView(meta, metaParams);

            TextView attendance = tv(
                    tr("حاضری (30 دن): ", "Attendance (30 days): ") +
                            child.optInt("attendancePresent30d", 0) +
                            " / " + child.optInt("attendanceTotal30d", 0),
                    12, TEXT, true);
            attendance.setGravity(englishMode() ? Gravity.LEFT : Gravity.RIGHT);
            LinearLayout.LayoutParams attendanceParams =
                    new LinearLayout.LayoutParams(-1, -2);
            attendanceParams.topMargin = dp(9);
            item.addView(attendance, attendanceParams);
            content.addView(item);
            addGap(content, 8);
        }
    }

    private void renderGuardianAttendance() {
        titleBlock(tr("حاضری", "Attendance"),
                tr("Guardian Portal • Talaba attendance",
                        "Guardian Portal • student attendance"));
        JSONArray children = guardianChildren();
        for (int i = 0; i < children.length(); i++) {
            JSONObject child = children.optJSONObject(i);
            if (child == null) continue;
            int total = child.optInt("attendanceTotal30d", 0);
            int present = child.optInt("attendancePresent30d", 0);
            addMetricRow(child.optString("name", englishMode() ? "Talaba" : "طالب علم"),
                    present + " / " + total,
                    tr("مدت", "Period"), "30 days", i == 0);
        }
        addActionCard(
                tr("بایومیٹرک ماخذ", "Biometric source"),
                tr("حاضری موجودہ Ilmgaah biometric attendance pipeline سے دکھائی جا رہی ہے.",
                        "Attendance is shown from the existing Ilmgaah biometric attendance pipeline."),
                "attendance");
    }

    private void renderGuardianHifz() {
        titleBlock(tr("حفظ", "Hifz"),
                tr("Guardian Portal • Hifz progress",
                        "Guardian Portal • Hifz progress"));
        JSONArray children = guardianChildren();
        for (int i = 0; i < children.length(); i++) {
            JSONObject child = children.optJSONObject(i);
            if (child == null) continue;
            LinearLayout item = card();
            TextView name = tv(childDisplay(child), 16, GREEN_DARK, true);
            name.setGravity(englishMode() ? Gravity.LEFT : Gravity.RIGHT);
            item.addView(name);

            JSONObject quran = child.optJSONObject("latestQuran");
            String summary = tr("Hifz progress linked", "Hifz progress linked");
            if (quran != null) {
                String chapter = quran.optString("surah", "").trim();
                String juz = quran.optString("juz", "").trim();
                if (!chapter.isEmpty() || !juz.isEmpty()) {
                    summary = tr("تازہ ترین: ", "Latest: ") + chapter +
                            (juz.isEmpty() ? "" : "  •  Juz " + juz);
                }
            }
            TextView details = tv(summary, 11, MUTED, false);
            details.setGravity(englishMode() ? Gravity.LEFT : Gravity.RIGHT);
            LinearLayout.LayoutParams detailsParams =
                    new LinearLayout.LayoutParams(-1, -2);
            detailsParams.topMargin = dp(6);
            item.addView(details, detailsParams);
            content.addView(item);
            addGap(content, 8);
        }
    }

    private void renderGuardianMore() {
        titleBlock(tr("مزید", "More"), "Guardian Portal");
        addActionCard(tr("اطلاعات", "Notices"),
                tr("جامعہ کی اہم اطلاعات", "Important institution notices"));
        addActionCard(tr("ہوم ورک", "Homework"),
                tr("Assigned homework from the portal", "Assigned homework from the portal"));
        addActionCard(tr("نتائج", "Results"),
                tr("Published examination results", "Published examination results"),
                "exams");
        addActionCard(tr("پروفائل", "Profile"),
                englishMode() ? ClientConfig.INSTITUTION + " • " + ClientConfig.ACADEMIC_YEAR
                        : ClientConfig.INSTITUTION_UR + " • " + ClientConfig.ACADEMIC_YEAR);
        addActionCard(tr("لاگ آؤٹ", "Logout"),
                tr("Guardian Portal سے سائن آؤٹ", "Sign out from Guardian Portal"),
                "logout");
    }

    private void renderTalaba() {
        boolean english = englishMode();
        titleBlock(tr("طلبہ", "Talaba"),
                tr("جامعہ کے طلبہ کا روزمرہ رجسٹر",
                        "Daily student register"));
        addMetricRow(tr("فعال طلبہ", "Active Talaba"), "—",
                tr("کل طلبہ", "Total Talaba"), "—", true);
        addActionCard(tr("طلبہ رجسٹر لوڈ ہو رہا ہے…", "Loading student register…"),
                tr("محفوظ live workspace data حاصل کیا جا رہا ہے۔",
                        "Loading secure live workspace data."));

        String url = ClientConfig.API_BASE +
                "/api/mobile/students?tenantId=" + tenantId +
                "&branchId=" + branchId +
                "&locale=" + (englishMode() ? "en" : "ur") +
                "&page=1&pageSize=30";
        NativeApi.get(url, accessToken, result -> {
            content.removeAllViews();
            titleBlock(tr("طلبہ", "Talaba"),
                    tr("جامعہ کے طلبہ کا live رجسٹر",
                            "Live student register"));

            if (!result.ok()) {
                addActionCard(tr("طلبہ ڈیٹا دستیاب نہیں", "Student data unavailable"),
                        tr("Live register ابھی حاصل نہیں ہو سکا۔ دوبارہ کھولیں۔",
                                "Live register could not be loaded. Tap Talaba again."));
                return;
            }

            JSONObject payload = NativeApi.json(result.body);
            int total = payload.optInt("total", 0);
            int active = payload.optInt("active", 0);
            addMetricRow(tr("فعال طلبہ", "Active Talaba"), String.valueOf(active),
                    tr("کل طلبہ", "Total Talaba"), String.valueOf(total), true);
            sectionLabel(tr("Talaba رجسٹر", "Talaba register"));

            JSONArray rows = payload.optJSONArray("rows");
            if (rows == null || rows.length() == 0) {
                addActionCard(tr("ابھی کوئی Talaba نہیں", "No Talaba yet"),
                        tr("اس branch میں موجودہ register خالی ہے.",
                                "The current branch register is empty."));
                return;
            }

            for (int i = 0; i < rows.length(); i++) {
                JSONObject row = rows.optJSONObject(i);
                if (row == null) continue;

                LinearLayout item = card();
                item.setOnClickListener(v -> renderStudentDetail(row.optInt("personId", 0)));
                LinearLayout top = row();
                item.addView(top);

                TextView number = tv(row.optString("studentNumber", "—"), 11, BLUE, true);
                number.setGravity(Gravity.CENTER);
                number.setPadding(dp(10), dp(7), dp(10), dp(7));
                number.setBackground(rounded(BLUE_SOFT, BLUE_SOFT, 12));
                top.addView(number, new LinearLayout.LayoutParams(dp(88), dp(38)));

                LinearLayout copy = new LinearLayout(this);
                copy.setOrientation(LinearLayout.VERTICAL);
                copy.setPadding(dp(10), 0, 0, 0);
                top.addView(copy, new LinearLayout.LayoutParams(0, -2, 1f));

                TextView name = tv(row.optString("name", "Talaba"), 15, GREEN_DARK, true);
                name.setGravity(Gravity.RIGHT);
                copy.addView(name);
                String nativeName = row.optString("nativeName", "").trim();
                if (!englishMode() && !nativeName.isEmpty()) {
                    TextView nativeText = tv(nativeName, 11, MUTED, false);
                    nativeText.setGravity(Gravity.RIGHT);
                    copy.addView(nativeText);
                }

                TextView meta = tv(
                        row.optString("program", "—") + "  •  " + row.optString("group", "—") +
                                "  •  " + row.optString("status", "active"),
                        11, MUTED, false);
                meta.setGravity(Gravity.RIGHT);
                LinearLayout.LayoutParams metaParams = new LinearLayout.LayoutParams(-1, -2);
                metaParams.topMargin = dp(7);
                item.addView(meta, metaParams);

                content.addView(item, new LinearLayout.LayoutParams(-1, -2));
                addGap(content, 8);
            }
        });
    }

    private void renderStudentDetail(int personId) {
        content.removeAllViews();
        TextView back = tv(englishMode() ? "‹  Talaba" : "‹  طلبہ", 13, BLUE, true);
        back.setGravity(englishMode() ? Gravity.LEFT : Gravity.RIGHT);
        back.setPadding(dp(4), dp(6), dp(4), dp(8));
        back.setOnClickListener(v -> showScreen("talaba"));
        content.addView(back, new LinearLayout.LayoutParams(-1, -2));
        titleBlock(tr("طالب علم پروفائل", "Student profile"),
                tr("Talaba • live profile", "Talaba • live profile"));
        addActionCard(tr("پروفائل لوڈ ہو رہی ہے…", "Loading profile…"),
                tr("محفوظ live student record حاصل کیا جا رہا ہے۔",
                        "Loading the secure live student record."));

        if (personId <= 0) {
            content.removeAllViews();
            titleBlock(tr("طالب علم پروفائل", "Student profile"), "Talaba");
            addActionCard("پروفائل دستیاب نہیں", "Student identifier درست نہیں ہے۔");
            return;
        }

        String url = ClientConfig.API_BASE +
                "/api/mobile/students/" + personId +
                "?tenantId=" + tenantId + "&branchId=" + branchId +
                "&locale=" + (englishMode() ? "en" : "ur");
        NativeApi.get(url, accessToken, result -> {
            content.removeAllViews();
            TextView backLoaded = tv(englishMode() ? "‹  Talaba" : "‹  طلبہ", 13, BLUE, true);
            backLoaded.setGravity(englishMode() ? Gravity.LEFT : Gravity.RIGHT);
            backLoaded.setPadding(dp(4), dp(6), dp(4), dp(8));
            backLoaded.setOnClickListener(v -> showScreen("talaba"));
            content.addView(backLoaded, new LinearLayout.LayoutParams(-1, -2));
            titleBlock(tr("طالب علم پروفائل", "Student profile"), "Talaba • live profile");

            if (!result.ok()) {
                addActionCard(tr("پروفائل دستیاب نہیں", "Profile unavailable"),
                        tr("Live student record ابھی حاصل نہیں ہو سکا۔",
                                "Live student record could not be loaded."));
                return;
            }

            JSONObject payload = NativeApi.json(result.body);
            JSONObject student = payload.optJSONObject("student");
            JSONObject attendance = payload.optJSONObject("attendance");
            if (student == null) {
                addActionCard("پروفائل خالی ہے", "Student service نے کوئی record واپس نہیں کیا۔");
                return;
            }

            LinearLayout identity = card();
            TextView name = tv(student.optString("name", englishMode() ? "Talaba" : "طالب علم"), 22, GREEN_DARK, true);
            name.setGravity(englishMode() ? Gravity.LEFT : Gravity.RIGHT);
            identity.addView(name);
            String nativeName = student.optString("nativeName", "").trim();
            if (!englishMode() && !nativeName.isEmpty()) {
                TextView nativeText = tv(nativeName, 13, MUTED, false);
                nativeText.setGravity(Gravity.RIGHT);
                LinearLayout.LayoutParams np = new LinearLayout.LayoutParams(-1, -2);
                np.topMargin = dp(5);
                identity.addView(nativeText, np);
            }
            TextView number = tv(
                    student.optString("studentNumber", "—") + "  •  " +
                            student.optString("admissionNumber", "—"),
                    12, MUTED, false);
            number.setGravity(englishMode() ? Gravity.LEFT : Gravity.RIGHT);
            LinearLayout.LayoutParams nump = new LinearLayout.LayoutParams(-1, -2);
            nump.topMargin = dp(9);
            identity.addView(number, nump);
            content.addView(identity);
            addGap(content, 10);

            addMetricRow(tr("حاضری", "Present"), attendance == null ? "—" : String.valueOf(attendance.optInt("present", 0)),
                    tr("غیر حاضر", "Absent"), attendance == null ? "—" : String.valueOf(attendance.optInt("absent", 0)), true);
            addMetricRow(tr("تاخیر", "Late"), attendance == null ? "—" : String.valueOf(attendance.optInt("late", 0)),
                    tr("کل ریکارڈ", "Total records"), attendance == null ? "—" : String.valueOf(attendance.optInt("total", 0)), false);

            sectionLabel(tr("تعلیمی معلومات", "Academic information"));
            addActionCard(tr("پروگرام", "Program"), student.optString("program", "—"));
            addActionCard(tr("گروپ / کلاس", "Group / class"), student.optString("group", "—"));
            addActionCard(tr("حیثیت", "Status"), student.optString("status", "—"));
            addActionCard(tr("شمولیت", "Joined"), student.optString("joinedOn", "—"));

            sectionLabel(tr("ماڈیول خلاصہ", "Module summary"));
            int quranAttempts = payload.optInt("quranAttempts", 0);
            int resultCount = payload.optInt("resultCount", 0);
            addMetricRow(tr("حفظ attempts", "Hifz attempts"), String.valueOf(quranAttempts),
                    tr("نتائج", "Results"), String.valueOf(resultCount), false);
        });
    }

    private void loadAdmissionOptions(
            Spinner sessionSpinner,
            Spinner programSpinner,
            Spinner groupSpinner,
            TextView status,
            ArrayList<AdmissionOption> sessions,
            ArrayList<AdmissionOption> programs,
            ArrayList<AdmissionOption> groups,
            Button complete
    ) {
        if (tenantId <= 0 || branchId <= 0 || accessToken.isEmpty()) {
            status.setText(tr("ورک اسپیس دستیاب نہیں۔", "Workspace is unavailable."));
            return;
        }

        String url = ClientConfig.API_BASE +
                "/api/mobile/admission/options?tenantId=" + tenantId +
                "&branchId=" + branchId;

        NativeApi.get(url, accessToken, result -> {
            if (!result.ok()) {
                status.setText(tr(
                        "اکیڈمک اختیارات لوڈ نہیں ہو سکے۔",
                        "Could not load academic options."));
                return;
            }

            JSONObject payload = NativeApi.json(result.body);
            JSONArray sessionRows = payload.optJSONArray("sessions");
            JSONArray programRows = payload.optJSONArray("programs");
            JSONArray groupRows = payload.optJSONArray("groups");

            if (sessionRows != null) {
                for (int i = 0; i < sessionRows.length(); i++) {
                    JSONObject row = sessionRows.optJSONObject(i);
                    if (row == null) continue;
                    sessions.add(new AdmissionOption(
                            row.optInt("id", 0),
                            localizedOptionLabel(row, row.optString("key", "Session"))));
                }
            }

            if (programRows != null) {
                for (int i = 0; i < programRows.length(); i++) {
                    JSONObject row = programRows.optJSONObject(i);
                    if (row == null) continue;
                    programs.add(new AdmissionOption(
                            row.optInt("id", 0),
                            localizedOptionLabel(row, row.optString("key", "Program"))));
                }
            }

            if (groupRows != null) {
                for (int i = 0; i < groupRows.length(); i++) {
                    JSONObject row = groupRows.optJSONObject(i);
                    if (row == null) continue;
                    groups.add(new AdmissionOption(
                            row.optInt("id", 0),
                            localizedOptionLabel(row, row.optString("key", "Class/group")),
                            row.optInt("session_id", 0),
                            row.optInt("program_id", 0)));
                }
            }

            bindAdmissionSpinner(sessionSpinner, sessions);
            bindAdmissionSpinner(programSpinner, programs);
            updateAdmissionGroups(groupSpinner, sessions, programs, groups, 0, 0);
            complete.setEnabled(!sessions.isEmpty() && !programs.isEmpty() && !groups.isEmpty());
            status.setText(
                    groups.isEmpty()
                            ? tr("فعال کلاس / گروپ دستیاب نہیں۔", "No active classes / groups are available.")
                            : tr("اکیڈمک اختیارات تیار ہیں۔", "Academic options loaded."));
        });
    }

    private void bindAdmissionSpinner(Spinner spinner, ArrayList<AdmissionOption> options) {
        ArrayAdapter<AdmissionOption> adapter = new ArrayAdapter<>(
                this, android.R.layout.simple_spinner_item, options);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spinner.setAdapter(adapter);
    }

    private void updateAdmissionGroups(
            Spinner groupSpinner,
            ArrayList<AdmissionOption> sessions,
            ArrayList<AdmissionOption> programs,
            ArrayList<AdmissionOption> allGroups,
            int sessionId,
            int programId
    ) {
        ArrayList<AdmissionOption> filtered = new ArrayList<>();
        for (AdmissionOption option : allGroups) {
            if ((sessionId == 0 || option.sessionId == sessionId)
                    && (programId == 0 || option.programId == programId)) {
                filtered.add(option);
            }
        }
        bindAdmissionSpinner(groupSpinner, filtered);
        if (filtered.isEmpty() && !allGroups.isEmpty()) {
            bindAdmissionSpinner(groupSpinner, allGroups);
        }
    }

    private void formSectionLabel(LinearLayout parent, String text) {
        TextView view = tv(text, 14, GREEN_DARK, true);
        view.setGravity(englishMode() ? Gravity.LEFT : Gravity.RIGHT);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.topMargin = dp(18);
        params.bottomMargin = dp(8);
        parent.addView(view, params);
    }

    private void bindStringSpinner(Spinner spinner, ArrayList<String> options) {
        ArrayAdapter<String> adapter = new ArrayAdapter<>(
                this, android.R.layout.simple_spinner_item, options);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spinner.setAdapter(adapter);
    }

    private void pickDate(EditText target, boolean todayByDefault) {
        java.util.Calendar calendar = java.util.Calendar.getInstance();
        String existing = target.getText().toString().trim();
        if (existing.matches("^\\d{4}-\\d{2}-\\d{2}$")) {
            try {
                Date parsed = new SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(existing);
                if (parsed != null) calendar.setTime(parsed);
            } catch (Exception ignored) {
                // Use today when the current value is invalid.
            }
        } else if (!todayByDefault) {
            calendar.setTime(new Date());
        }
        new DatePickerDialog(
                this,
                (view, year, month, dayOfMonth) ->
                        target.setText(String.format(
                                Locale.US, "%04d-%02d-%02d",
                                year, month + 1, dayOfMonth)),
                calendar.get(java.util.Calendar.YEAR),
                calendar.get(java.util.Calendar.MONTH),
                calendar.get(java.util.Calendar.DAY_OF_MONTH)
        ).show();
    }

    private void chooseAdmissionPhoto() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");
        startActivityForResult(intent, ADMISSION_PHOTO_REQUEST);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != ADMISSION_PHOTO_REQUEST || resultCode != RESULT_OK || data == null) {
            return;
        }
        Uri uri = data.getData();
        if (uri == null) return;
        admissionPhotoUri = uri;
        admissionPhotoToken = "";
        try {
            getContentResolver().takePersistableUriPermission(
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (Exception ignored) {
            // Temporary read permission remains valid for the current flow.
        }
        if (admissionPhotoStatus != null) {
            admissionPhotoStatus.setText(
                    tr("منتخب: " + admissionPhotoName(uri),
                            "Selected: " + admissionPhotoName(uri)));
        }
    }

    private String admissionPhotoName(Uri uri) {
        Cursor cursor = null;
        try {
            cursor = getContentResolver().query(
                    uri,
                    new String[]{OpenableColumns.DISPLAY_NAME},
                    null,
                    null,
                    null);
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) {
                    String name = cursor.getString(index);
                    if (name != null && !name.trim().isEmpty()) return name.trim();
                }
            }
        } catch (Exception ignored) {
            // Use a safe fallback name.
        } finally {
            if (cursor != null) cursor.close();
        }
        return "student-photo.jpg";
    }

    private byte[] readAdmissionPhotoBytes(Uri uri) throws Exception {
        try (InputStream input = getContentResolver().openInputStream(uri);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            if (input == null) throw new IllegalStateException("photo_unreadable");
            byte[] buffer = new byte[8192];
            int total = 0;
            int count;
            while ((count = input.read(buffer)) != -1) {
                total += count;
                if (total > MAX_ADMISSION_PHOTO_BYTES) {
                    throw new IllegalArgumentException("photo_too_large");
                }
                output.write(buffer, 0, count);
            }
            return output.toByteArray();
        }
    }

    private String detectAdmissionPhotoType(byte[] bytes) {
        if (bytes.length >= 3
                && (bytes[0] & 0xff) == 0xff
                && (bytes[1] & 0xff) == 0xd8
                && (bytes[2] & 0xff) == 0xff) {
            return "image/jpeg";
        }
        if (bytes.length >= 8
                && (bytes[0] & 0xff) == 0x89
                && (bytes[1] & 0xff) == 0x50
                && (bytes[2] & 0xff) == 0x4e
                && (bytes[3] & 0xff) == 0x47
                && (bytes[4] & 0xff) == 0x0d
                && (bytes[5] & 0xff) == 0x0a
                && (bytes[6] & 0xff) == 0x1a
                && (bytes[7] & 0xff) == 0x0a) {
            return "image/png";
        }
        if (bytes.length >= 12
                && bytes[0] == 'R' && bytes[1] == 'I'
                && bytes[2] == 'F' && bytes[3] == 'F'
                && bytes[8] == 'W' && bytes[9] == 'E'
                && bytes[10] == 'B' && bytes[11] == 'P') {
            return "image/webp";
        }
        return null;
    }

    private String safePhotoFilename(Uri uri, String contentType) {
        String name = admissionPhotoName(uri)
                .replaceAll("[^A-Za-z0-9._-]", "_");
        if (name.length() > 90) name = name.substring(name.length() - 90);
        if (!name.contains(".")) {
            name += contentType.endsWith("png") ? ".png"
                    : contentType.endsWith("webp") ? ".webp" : ".jpg";
        }
        return name;
    }

    private interface AdmissionUploadCallback {
        void done(String token, String error);
    }

    private void uploadAdmissionPhoto(AdmissionUploadCallback callback) {
        if (admissionPhotoUri == null) {
            admissionUploadDone(callback, null,
                    tr("طالب علم کی تصویر مطلوب ہے۔", "Student photo is required."));
            return;
        }
        String cookie = admissionCookie();
        if (cookie.isEmpty()) {
            admissionUploadDone(callback, null, tr(
                    "سیشن دستیاب نہیں۔ دوبارہ سائن اِن کریں۔",
                    "Session unavailable. Please sign in again."));
            return;
        }

        new Thread(() -> {
            try {
                byte[] bytes = readAdmissionPhotoBytes(admissionPhotoUri);
                String contentType = detectAdmissionPhotoType(bytes);
                if (contentType == null) {
                    admissionUploadDone(callback, null, tr(
                            "صرف درست JPEG، PNG یا WebP تصویر استعمال کریں۔",
                            "Use a genuine JPEG, PNG, or WebP image."));
                    return;
                }
                String filename = safePhotoFilename(admissionPhotoUri, contentType);
                NativeApi.postMultipartWithCookie(
                        ClientConfig.API_BASE + "/api/admissions/staff-photo",
                        cookie,
                        "photo",
                        filename,
                        contentType,
                        bytes,
                        result -> {
                            JSONObject payload = NativeApi.json(result.body);
                            String token = payload.optString("photoToken", "");
                            if (!result.ok() || token.isEmpty()) {
                                admissionUploadDone(callback, null,
                                        payload.optString("error",
                                                tr("تصویر اپ لوڈ نہیں ہو سکی۔",
                                                        "Student photo could not be prepared.")));
                                return;
                            }
                            admissionPhotoToken = token;
                            if (admissionPhotoStatus != null) {
                                admissionPhotoStatus.setText(
                                        tr("تصویر تیار ہے۔", "Photo ready."));
                            }
                            admissionUploadDone(callback, token, null);
                        });
            } catch (IllegalArgumentException exception) {
                admissionUploadDone(callback, null, tr(
                        "تصویر 5 MB یا اس سے کم ہونی چاہیے۔",
                        "Student photo must be 5 MB or smaller."));
            } catch (Exception exception) {
                admissionUploadDone(callback, null, tr(
                        "تصویر پڑھ نہیں سکی۔ دوبارہ کوشش کریں۔",
                        "Student photo could not be read. Try again."));
            }
        }).start();
    }

    private void admissionUploadDone(
            AdmissionUploadCallback callback,
            String token,
            String error
    ) {
        runOnUiThread(() -> callback.done(token, error));
    }

    private void submitAdmission(
            EditText displayName,
            EditText nativeName,
            Spinner genderSpinner,
            EditText dobField,
            EditText joinedOn,
            EditText guardianName,
            Spinner relationshipSpinner,
            EditText guardianEmail,
            EditText guardianPhone,
            Spinner sessionSpinner,
            Spinner programSpinner,
            Spinner groupSpinner,
            TextView status,
            Button complete
    ) {
        String studentName = displayName.getText().toString().trim();
        String studentNativeName = nativeName.getText().toString().trim();
        int genderPosition = genderSpinner.getSelectedItemPosition();
        int relationshipPosition = relationshipSpinner.getSelectedItemPosition();
        int sessionPosition = sessionSpinner.getSelectedItemPosition();
        int programPosition = programSpinner.getSelectedItemPosition();
        int groupPosition = groupSpinner.getSelectedItemPosition();

        String gender = genderPosition == 1 ? "male"
                : genderPosition == 2 ? "female"
                : genderPosition == 3 ? "other"
                : genderPosition == 4 ? "undisclosed" : "";
        String relationship = relationshipPosition == 1 ? "father"
                : relationshipPosition == 2 ? "mother"
                : relationshipPosition == 3 ? "guardian"
                : relationshipPosition == 4 ? "other" : "";

        AdmissionOption session = sessionPosition >= 0 && sessionPosition < 10000
                && sessionSpinner.getSelectedItem() instanceof AdmissionOption
                ? (AdmissionOption) sessionSpinner.getSelectedItem() : null;
        AdmissionOption program = programPosition >= 0 && programPosition < 10000
                && programSpinner.getSelectedItem() instanceof AdmissionOption
                ? (AdmissionOption) programSpinner.getSelectedItem() : null;
        AdmissionOption group = groupPosition >= 0 && groupSpinner.getSelectedItem() instanceof AdmissionOption
                ? (AdmissionOption) groupSpinner.getSelectedItem() : null;

        String email = guardianEmail.getText().toString().trim();
        String joined = joinedOn.getText().toString().trim();

        if (studentName.length() < 2 || studentNativeName.length() < 2 || gender.isEmpty()) {
            status.setText(tr(
                    "طالب علم کا نام، اردو نام اور جنس درست درج کریں۔",
                    "Enter the student name, native name, and gender."));
            return;
        }
        if (guardianName.getText().toString().trim().length() < 2
                || relationship.isEmpty()
                || !email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            status.setText(tr(
                    "سرپرست کا نام، رشتہ اور درست ای میل ضروری ہے۔",
                    "Guardian name, relationship, and valid email are required."));
            return;
        }
        if (session == null || session.id <= 0
                || program == null || program.id <= 0
                || group == null || group.id <= 0
                || !joined.matches("^\\d{4}-\\d{2}-\\d{2}$")) {
            status.setText(tr(
                    "تعلیمی سال، پروگرام، کلاس / گروپ اور شمولیت کی تاریخ منتخب کریں۔",
                    "Choose academic year, program, class / group, and joining date."));
            return;
        }
        if (accessToken.isEmpty() || admissionCookie().isEmpty()) {
            status.setText(tr(
                    "سیشن ختم ہو چکا ہے۔ دوبارہ سائن اِن کریں۔",
                    "Your session has expired. Please sign in again."));
            return;
        }
        if (admissionPhotoUri == null && admissionPhotoToken.isEmpty()) {
            status.setText(tr(
                    "طالب علم کی تصویر مطلوب ہے۔",
                    "Student photo is required."));
            return;
        }

        complete.setEnabled(false);
        complete.setText(tr("جمع ہو رہا ہے…", "Submitting…"));
        status.setText(tr("داخلہ محفوظ کیا جا رہا ہے…", "Preparing admission…"));

        AdmissionUploadCallback continueWithPhoto = (photoToken, photoError) -> {
            if (photoError != null || photoToken == null || photoToken.isEmpty()) {
                complete.setEnabled(true);
                complete.setText(tr("داخلہ مکمل کریں", "Complete admission"));
                status.setText(photoError != null ? photoError
                        : tr("تصویر تیار نہیں ہو سکی۔", "Student photo could not be prepared."));
                return;
            }
            saveAndFinalizeAdmission(
                    studentName,
                    studentNativeName,
                    gender,
                    dobField.getText().toString().trim(),
                    joined,
                    guardianName.getText().toString().trim(),
                    email,
                    guardianPhone.getText().toString().trim(),
                    relationship,
                    session.id,
                    program.id,
                    group.id,
                    photoToken,
                    status,
                    complete);
        };

        if (!admissionPhotoToken.isEmpty()) {
            continueWithPhoto.done(admissionPhotoToken, null);
        } else {
            uploadAdmissionPhoto(continueWithPhoto);
        }
    }

    private void saveAndFinalizeAdmission(
            String studentName,
            String studentNativeName,
            String gender,
            String dob,
            String joinedOn,
            String guardianName,
            String guardianEmail,
            String guardianPhone,
            String relationship,
            int sessionId,
            int programId,
            int groupId,
            String photoToken,
            TextView status,
            Button complete
    ) {
        try {
            JSONObject body = new JSONObject();
            body.put("displayName", studentName);
            body.put("nameNative", studentNativeName);
            body.put("dateOfBirth", dob);
            body.put("gender", gender);
            body.put("preferredLocale", englishMode() ? "en" : "ur");
            body.put("sessionId", sessionId);
            body.put("programId", programId);
            body.put("groupId", groupId);
            body.put("joinedOn", joinedOn);
            body.put("guardianName", guardianName);
            body.put("guardianEmail", guardianEmail);
            body.put("guardianPhone", guardianPhone);
            body.put("guardianRelationship", relationship);
            body.put("photoToken", photoToken);
            body.put("confirmNewPerson", false);

            if (admissionDraftId > 0) {
                body.put("draftId", admissionDraftId);
            }

            status.setText(tr("ڈرافٹ محفوظ ہو رہا ہے…", "Saving admission draft…"));
            NativeApi.postJsonWithCookie(
                    ClientConfig.API_BASE + "/api/admissions/staff-draft",
                    body.toString(),
                    admissionCookie(),
                    result -> {
                        JSONObject payload = NativeApi.json(result.body);
                        if (!result.ok()) {
                            complete.setEnabled(true);
                            complete.setText(tr("داخلہ مکمل کریں", "Complete admission"));
                            status.setText(payload.optString(
                                    "error",
                                    tr("داخلہ ڈرافٹ محفوظ نہیں ہو سکا۔",
                                            "Admission draft could not be saved.")));
                            return;
                        }

                        JSONObject saved = payload.optJSONObject("result");
                        int savedDraftId = saved == null
                                ? 0 : saved.optInt("application_id", 0);
                        if (savedDraftId <= 0) {
                            complete.setEnabled(true);
                            complete.setText(tr("داخلہ مکمل کریں", "Complete admission"));
                            status.setText(tr(
                                    "ڈرافٹ آئی ڈی موصول نہیں ہوئی۔",
                                    "No admission draft ID was returned."));
                            return;
                        }
                        admissionDraftId = savedDraftId;
                        finalizeAdmissionDraft(
                                body,
                                savedDraftId,
                                status,
                                complete,
                                false);
                    });
        } catch (Exception exception) {
            complete.setEnabled(true);
            complete.setText(tr("داخلہ مکمل کریں", "Complete admission"));
            status.setText(tr(
                    "درخواست تیار نہیں ہو سکی۔ دوبارہ کوشش کریں۔",
                    "The admission request could not be prepared. Try again."));
        }
    }

    private void finalizeAdmissionDraft(
            JSONObject draftBody,
            int draftId,
            TextView status,
            Button complete,
            boolean confirmNewPerson
    ) {
        try {
            JSONObject body = new JSONObject(draftBody.toString());
            body.put("draftId", draftId);
            body.put("confirmNewPerson", confirmNewPerson);
            status.setText(tr("داخلہ مکمل ہو رہا ہے…", "Creating admission…"));

            NativeApi.postJsonWithCookie(
                    ClientConfig.API_BASE + "/api/admissions/finalize",
                    body.toString(),
                    admissionCookie(),
                    result -> {
                        JSONObject payload = NativeApi.json(result.body);
                        if (result.status == 409
                                && payload.optBoolean("duplicateReviewRequired", false)
                                && !confirmNewPerson) {
                            complete.setEnabled(true);
                            complete.setText(tr("داخلہ مکمل کریں", "Complete admission"));
                            int candidates = payload.optInt("candidateCount", 0);
                            String message = payload.optString(
                                    "error",
                                    tr("ممکنہ ڈپلیکیٹ طالب علم ملا۔",
                                            "A possible duplicate student was found."));
                            if (candidates > 0) {
                                message += "\n\n" + candidates + " "
                                        + tr("ممکنہ ریکارڈ۔", "possible matching record(s).");
                            }
                            status.setText(message);
                            new AlertDialog.Builder(this)
                                    .setTitle(tr("ممکنہ ڈپلیکیٹ", "Possible duplicate"))
                                    .setMessage(message)
                                    .setNegativeButton(tr("منسوخ", "Cancel"),
                                            (dialog, which) -> complete.setEnabled(true))
                                    .setPositiveButton(
                                            tr("الگ طالب علم بنائیں", "Create separate student"),
                                            (dialog, which) -> {
                                                complete.setEnabled(false);
                                                complete.setText(tr(
                                                        "جمع ہو رہا ہے…", "Submitting…"));
                                                finalizeAdmissionDraft(
                                                        draftBody,
                                                        draftId,
                                                        status,
                                                        complete,
                                                        true);
                                            })
                                    .show();
                            return;
                        }

                        if (!result.ok()) {
                            complete.setEnabled(true);
                            complete.setText(tr("داخلہ مکمل کریں", "Complete admission"));
                            status.setText(payload.optString(
                                    "error",
                                    tr("داخلہ مکمل نہیں ہو سکا۔",
                                            "Admission could not be completed.")));
                            return;
                        }

                        JSONObject saved = payload.optJSONObject("result");
                        int personId = saved == null ? 0 : saved.optInt("personId", 0);
                        String studentNumber = saved == null
                                ? "" : saved.optString("studentNumber", "");
                        if (personId <= 0 || studentNumber.isEmpty()) {
                            complete.setEnabled(true);
                            complete.setText(tr("داخلہ مکمل کریں", "Complete admission"));
                            status.setText(tr(
                                    "طالب علم لنک موصول نہیں ہوا۔",
                                    "A valid student linkage was not returned."));
                            return;
                        }

                        admissionDraftId = 0;
                        admissionPhotoToken = "";
                        complete.setEnabled(false);
                        complete.setText(tr("داخلہ مکمل ہو گیا", "Admission completed"));
                        status.setText(
                                tr("طالب علم نمبر: ", "Student number: ") + studentNumber);

                        new AlertDialog.Builder(this)
                                .setTitle(tr(
                                        "داخلہ کامیابی سے مکمل",
                                        "Admission created successfully"))
                                .setMessage(
                                        tr("طالب علم نمبر: ", "Student number: ") + studentNumber)
                                .setPositiveButton(tr("طلبہ کھولیں", "Open students"),
                                        (dialog, which) -> {
                                            loadRoleData();
                                            showScreen("talaba");
                                        })
                                .setNegativeButton(tr("یہاں رہیں", "Stay"), null)
                                .show();
                    });
        } catch (Exception exception) {
            complete.setEnabled(true);
            complete.setText(tr("داخلہ مکمل کریں", "Complete admission"));
            status.setText(tr(
                    "داخلہ درخواست تیار نہیں ہو سکی۔",
                    "The admission request could not be prepared."));
        }
    }

    private void renderAdmissionForm() {
        content.removeAllViews();
        admissionPhotoUri = null;
        admissionPhotoToken = "";
        admissionDraftId = 0;
        admissionPhotoStatus = null;
        boolean english = englishMode();

        TextView back = tv(english ? "← Admissions" : "→ داخلہ", 14, GREEN_DARK, true);
        back.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        back.setClickable(true);
        back.setFocusable(true);
        back.setOnClickListener(v -> showScreen("admissions"));
        content.addView(back, new LinearLayout.LayoutParams(-1, dp(38)));

        titleBlock(
                tr("نیا داخلہ", "New admission"),
                tr("Talaba، سرپرست اور تعلیمی تعیناتی درج کریں",
                        "Enter student, guardian and academic placement"));

        LinearLayout form = card();
        content.addView(form, new LinearLayout.LayoutParams(-1, -2));

        formSectionLabel(form, tr("طالب علم", "Student"));
        TextView displayLabel = tv(tr("نام", "Name"), 12, MUTED, true);
        form.addView(displayLabel);
        EditText displayName = field(tr("طالب علم کا نام", "Student name"));
        form.addView(displayName, new LinearLayout.LayoutParams(-1, dp(54)));

        addGap(form, 10);
        TextView nativeLabel = tv(tr("مقامی نام", "Native name"), 12, MUTED, true);
        form.addView(nativeLabel);
        EditText nativeName = field(tr("اردو / مقامی نام", "Urdu / native name"));
        nativeName.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        form.addView(nativeName, new LinearLayout.LayoutParams(-1, dp(54)));

        addGap(form, 10);
        TextView genderLabel = tv(tr("جنس", "Gender"), 12, MUTED, true);
        form.addView(genderLabel);
        Spinner genderSpinner = new Spinner(this);
        ArrayList<String> genderOptions = new ArrayList<>();
        if (english) {
            genderOptions.add("Select gender");
            genderOptions.add("Male");
            genderOptions.add("Female");
            genderOptions.add("Other");
            genderOptions.add("Undisclosed");
        } else {
            genderOptions.add("جنس منتخب کریں");
            genderOptions.add("مرد");
            genderOptions.add("خاتون");
            genderOptions.add("دیگر");
            genderOptions.add("ظاہر نہیں کرنا");
        }
        bindStringSpinner(genderSpinner, genderOptions);
        form.addView(genderSpinner, new LinearLayout.LayoutParams(-1, dp(54)));

        addGap(form, 10);
        TextView dobLabel = tv(tr("تاریخ پیدائش", "Date of birth"), 12, MUTED, true);
        form.addView(dobLabel);
        EditText dobField = field(tr("اختیاری", "Optional"));
        dobField.setFocusable(false);
        dobField.setClickable(true);
        form.addView(dobField, new LinearLayout.LayoutParams(-1, dp(54)));
        dobField.setOnClickListener(v -> pickDate(dobField, false));

        addGap(form, 10);
        TextView joinLabel = tv(tr("شمولیت کی تاریخ", "Joining date"), 12, MUTED, true);
        form.addView(joinLabel);
        EditText joinedOn = field(isoToday());
        joinedOn.setText(isoToday());
        joinedOn.setFocusable(false);
        joinedOn.setClickable(true);
        form.addView(joinedOn, new LinearLayout.LayoutParams(-1, dp(54)));
        joinedOn.setOnClickListener(v -> pickDate(joinedOn, true));

        addGap(form, 10);
        TextView photoLabel = tv(tr("طالب علم کی تصویر", "Student photo"), 12, MUTED, true);
        form.addView(photoLabel);
        Button choosePhoto = primaryButton(tr("تصویر منتخب کریں", "Choose photo"));
        form.addView(choosePhoto, new LinearLayout.LayoutParams(-1, dp(50)));
        admissionPhotoStatus = tv(
                tr("تصویر مطلوب ہے۔", "Photo required."),
                11, MUTED, false);
        LinearLayout.LayoutParams photoStatusParams = new LinearLayout.LayoutParams(-1, -2);
        photoStatusParams.topMargin = dp(6);
        form.addView(admissionPhotoStatus, photoStatusParams);
        choosePhoto.setOnClickListener(v -> chooseAdmissionPhoto());

        formSectionLabel(form, tr("سرپرست", "Guardian"));
        TextView guardianNameLabel = tv(tr("سرپرست کا نام", "Guardian name"), 12, MUTED, true);
        form.addView(guardianNameLabel);
        EditText guardianName = field(tr("پورا نام", "Full name"));
        form.addView(guardianName, new LinearLayout.LayoutParams(-1, dp(54)));

        addGap(form, 10);
        TextView relationshipLabel = tv(tr("رشتہ", "Relationship"), 12, MUTED, true);
        form.addView(relationshipLabel);
        Spinner relationshipSpinner = new Spinner(this);
        ArrayList<String> relationshipOptions = new ArrayList<>();
        if (english) {
            relationshipOptions.add("Select relationship");
            relationshipOptions.add("Father");
            relationshipOptions.add("Mother");
            relationshipOptions.add("Guardian");
            relationshipOptions.add("Other");
        } else {
            relationshipOptions.add("رشتہ منتخب کریں");
            relationshipOptions.add("والد");
            relationshipOptions.add("والدہ");
            relationshipOptions.add("سرپرست");
            relationshipOptions.add("دیگر");
        }
        bindStringSpinner(relationshipSpinner, relationshipOptions);
        form.addView(relationshipSpinner, new LinearLayout.LayoutParams(-1, dp(54)));

        addGap(form, 10);
        TextView guardianEmailLabel = tv(tr("ای میل", "Email"), 12, MUTED, true);
        form.addView(guardianEmailLabel);
        EditText guardianEmail = field(tr("سرپرست کی ای میل", "Guardian email"));
        guardianEmail.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        guardianEmail.setTextDirection(View.TEXT_DIRECTION_LTR);
        form.addView(guardianEmail, new LinearLayout.LayoutParams(-1, dp(54)));

        addGap(form, 10);
        TextView guardianPhoneLabel = tv(tr("فون", "Phone"), 12, MUTED, true);
        form.addView(guardianPhoneLabel);
        EditText guardianPhone = field(tr("اختیاری", "Optional"));
        guardianPhone.setInputType(InputType.TYPE_CLASS_PHONE);
        guardianPhone.setTextDirection(View.TEXT_DIRECTION_LTR);
        form.addView(guardianPhone, new LinearLayout.LayoutParams(-1, dp(54)));

        formSectionLabel(form, tr("تعلیمی تعیناتی", "Academic placement"));
        TextView sessionLabel = tv(tr("تعلیمی سیشن", "Academic session"), 12, MUTED, true);
        form.addView(sessionLabel);
        Spinner sessionSpinner = new Spinner(this);
        form.addView(sessionSpinner, new LinearLayout.LayoutParams(-1, dp(54)));

        addGap(form, 10);
        TextView programLabel = tv(tr("پروگرام", "Program"), 12, MUTED, true);
        form.addView(programLabel);
        Spinner programSpinner = new Spinner(this);
        form.addView(programSpinner, new LinearLayout.LayoutParams(-1, dp(54)));

        addGap(form, 10);
        TextView groupLabel = tv(tr("کلاس / گروپ", "Class / group"), 12, MUTED, true);
        form.addView(groupLabel);
        Spinner groupSpinner = new Spinner(this);
        form.addView(groupSpinner, new LinearLayout.LayoutParams(-1, dp(54)));

        TextView status = tv("", 12, MUTED, true);
        LinearLayout.LayoutParams statusParams = new LinearLayout.LayoutParams(-1, -2);
        statusParams.topMargin = dp(12);
        form.addView(status, statusParams);

        Button complete = primaryButton(tr("داخلہ مکمل کریں", "Complete admission"));
        LinearLayout.LayoutParams completeParams = new LinearLayout.LayoutParams(-1, dp(54));
        completeParams.topMargin = dp(14);
        form.addView(complete, completeParams);

        TextView safeNote = tv(
                tr("جمع کرانے سے پہلے تمام معلومات دوبارہ چیک کریں۔",
                        "Review all information before submitting."),
                11, MUTED, false);
        LinearLayout.LayoutParams noteParams = new LinearLayout.LayoutParams(-1, -2);
        noteParams.topMargin = dp(8);
        form.addView(safeNote, noteParams);

        ArrayList<AdmissionOption> sessions = new ArrayList<>();
        ArrayList<AdmissionOption> programs = new ArrayList<>();
        ArrayList<AdmissionOption> groups = new ArrayList<>();

        sessionSpinner.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) {
                AdmissionOption session = position < sessions.size() ? sessions.get(position) : null;
                AdmissionOption program = programSpinner.getSelectedItem() instanceof AdmissionOption
                        ? (AdmissionOption) programSpinner.getSelectedItem() : null;
                updateAdmissionGroups(groupSpinner, sessions, programs, groups,
                        session == null ? 0 : session.id,
                        program == null ? 0 : program.id);
            }
            @Override public void onNothingSelected(android.widget.AdapterView<?> parent) {}
        });
        programSpinner.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) {
                AdmissionOption session = sessionSpinner.getSelectedItem() instanceof AdmissionOption
                        ? (AdmissionOption) sessionSpinner.getSelectedItem() : null;
                AdmissionOption program = position < programs.size() ? programs.get(position) : null;
                updateAdmissionGroups(groupSpinner, sessions, programs, groups,
                        session == null ? 0 : session.id,
                        program == null ? 0 : program.id);
            }
            @Override public void onNothingSelected(android.widget.AdapterView<?> parent) {}
        });

        complete.setEnabled(false);
        loadAdmissionOptions(sessionSpinner, programSpinner, groupSpinner, status,
                sessions, programs, groups, complete);

        complete.setOnClickListener(v -> submitAdmission(
                displayName, nativeName, genderSpinner, dobField, joinedOn,
                guardianName, relationshipSpinner, guardianEmail, guardianPhone,
                sessionSpinner, programSpinner, groupSpinner, status, complete));
    }

    private void renderAdmissions() {
        titleBlock(tr("داخلہ", "Admissions"), tr("داخلہ ورک فلو", "Admissions workflow"));
        addMetricRow(tr("اوپن درخواستیں", "Open applications"), liveAdmissions,
                tr("پروگرام", "Program"), "Hifz + Arabic", true);
        sectionLabel(tr("اہم مراحل", "Key stages"));
        addActionCard(tr("نیا داخلہ", "New admission"),
                tr("Walk-in یا online admission record", "Walk-in or online admission record"),
                "admission-new");
        addActionCard(tr("درخواست کی جانچ", "Application review"),
                tr("Review، decision اور follow-up", "Review, decision and follow-up"));
        addActionCard(tr("Talaba میں تبدیل کریں", "Convert to Talaba"),
                tr("Accepted admission → Talaba record", "Accepted admission → Talaba record"),
                "students");
    }
    private void renderAcademics() {
        titleBlock(tr("اکیڈمکس", "Academic"),
                tr("حفظ اور عربی تعلیم کے لیے academic workspace",
                        "Academic workspace for Hifz and Arabic learning"));
        addActionCard(tr("حفظ پروگرام", "Hifz program"),
                tr("روزانہ سبق، سبق دَور، revision اور progress",
                        "Daily lesson, revision and progress"),
                "quran");
        addActionCard(tr("عربی پروگرام", "Arabic program"),
                tr("کلاس، مضمون اور نصاب کی بنیاد",
                        "Classes, subjects and curriculum"),
                "programs");
        addActionCard(tr("ٹائم ٹیبل", "Timetable"),
                tr("برانچ اور کلاس کے روزمرہ اوقات",
                        "Daily branch and class schedule"),
                "people-academics");
        addActionCard(tr("Ustadh teaching view", "Ustadh teaching"),
                tr("متعلقہ classes اور Talaba", "Assigned classes and students"),
                "my-students");
    }

    private void renderHifz() {
        titleBlock(tr("قرآن و حفظ", "Qur’an & Hifz"),
                tr("Hifz register • روزانہ کارکردگی اور revision",
                        "Hifz register • daily progress and revision"));
        addMetricRow(tr("پروگرام", "Program"), "Hifz",
                tr("Revision", "Revision"), tr("روزانہ", "Daily"), true);
        addActionCard(tr("روزانہ حفظ رجسٹر", "Daily Hifz register"),
                tr("سبق، دَور اور recitation attempt",
                        "Lesson, revision and recitation attempts"),
                "quran");
        addActionCard(tr("طلبہ کی پیش رفت", "Student progress"),
                tr("طالب علم کی حفظ progress اور strength",
                        "Student Hifz progress and review"),
                "quran");
        addActionCard(tr("Revision due", "Revision due"),
                tr("جن طلبہ کی مراجعت باقی ہے", "Students with revision due"),
                "quran/revision");
        addActionCard(tr("Ustadh review", "Ustadh review"),
                tr("Ustadh کے لیے daily Hifz workflow",
                        "Daily Hifz review workflow"),
                "quran");
    }

    private void renderExams() {
        titleBlock(tr("امتحانات و نتائج", "Exams & results"),
                tr("امتحانات، نمبر اور نتائج", "Exams, marks and published results"));
        addActionCard(tr("Exam setup", "Exam setup"),
                tr("Exam series اور candidate roster", "Exam series and candidate roster"),
                "exams");
        addActionCard(tr("Marks", "Marks"),
                tr("Marks entry اور moderation", "Marks entry and moderation"),
                "exams");
        addActionCard(tr("Results", "Results"),
                tr("Published result view", "Published results"),
                "exams");
        addActionCard(tr("Reports", "Reports"),
                tr("نتائج کی رپورٹنگ اور export", "Result reporting and export"),
                "exams");
    }
    private String todayIso() {
        return new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(new java.util.Date());
    }

    private String attendanceStatusLabel(JSONObject row) {
        String category = row.optString("status_category", "").trim();
        if (englishMode()) {
            if ("present".equals(category)) return "Present";
            if ("absent".equals(category)) return "Absent";
            if ("late".equals(category)) return "Late";
            if ("leave".equals(category) || "excused".equals(category)) return "Leave";
            return "Unmarked";
        }
        if ("present".equals(category)) return "حاضر";
        if ("absent".equals(category)) return "غیر حاضر";
        if ("late".equals(category)) return "تاخیر";
        if ("leave".equals(category) || "excused".equals(category)) return "رخصت";
        return "غیر نشان زدہ";
    }

    private void renderAttendance() {
        titleBlock(tr("حاضری", "Attendance"),
                tr("روزانہ student attendance • biometric pipeline",
                        "Daily student attendance • biometric pipeline"));
        addActionCard(
                tr("مکمل حاضری ورک اسپیس", "Open full attendance"),
                tr("روزانہ roster، devices اور attendance management.",
                        "Daily roster, devices and attendance management."));
        addActionCard(
                tr("حاضری لوڈ ہو رہی ہے…", "Loading attendance…"),
                tr("Live roster اور attendance summary حاصل کی جا رہی ہے۔",
                        "Loading the live roster and attendance summary."));

        String url = ClientConfig.API_BASE +
                "/api/mobile/attendance?tenantId=" + tenantId +
                "&branchId=" + branchId +
                "&date=" + todayIso() +
                "&view=student&page=1&pageSize=50";
        NativeApi.get(url, accessToken, result -> {
            content.removeAllViews();
            titleBlock(tr("حاضری", "Attendance"),
                    tr("روزانہ student attendance • live workspace",
                            "Daily student attendance • live workspace"));

            if (!result.ok()) {
                addActionCard(tr("حاضری ڈیٹا دستیاب نہیں", "Attendance data unavailable"),
                        tr("Live attendance ابھی حاصل نہیں ہو سکی۔ دوبارہ کھولیں.",
                                "Live attendance could not be loaded. Tap Attendance again."));
                return;
            }

            JSONObject payload = NativeApi.json(result.body);
            JSONObject attendance = payload.optJSONObject("attendance");
            if (attendance == null) {
                addActionCard(tr("حاضری دستیاب نہیں", "Attendance unavailable"),
                        tr("Attendance service نے کوئی workspace response نہیں دیا۔",
                                "The attendance service returned no workspace data."));
                return;
            }

            JSONObject summary = attendance.optJSONObject("summary");
            int total = summary == null ? attendance.optInt("total", 0) : summary.optInt("total", 0);
            int present = summary == null ? 0 : summary.optInt("present", 0);
            int absent = summary == null ? 0 : summary.optInt("absent", 0);
            int late = summary == null ? 0 : summary.optInt("late", 0);
            int leave = summary == null ? 0 : summary.optInt("leave", 0);
            int unmarked = summary == null ? 0 : summary.optInt("unmarked", 0);

            addMetricRow(tr("کل", "Total"), String.valueOf(total),
                    tr("حاضر", "Present"), String.valueOf(present), true);
            addMetricRow(tr("غیر حاضر", "Absent"), String.valueOf(absent),
                    tr("تاخیر / رخصت", "Late / leave"), String.valueOf(late + leave), false);
            if (unmarked > 0) addActionCard(
                    tr("باقی غیر نشان زدہ", "Unmarked"),
                    String.valueOf(unmarked) + " " +
                            tr("Talaba کی حاضری مکمل نہیں ہوئی۔",
                                    "Talaba still need an attendance mark."));

            sectionLabel(tr("آج کا roster", "Today's roster"));
            JSONArray rows = attendance.optJSONArray("rows");
            if (rows == null || rows.length() == 0) {
                boolean started = attendance.optBoolean("started", false);
                addActionCard(
                        started ? tr("آج کا roster خالی ہے", "Today's roster is empty")
                                : tr("آج کی حاضری شروع نہیں ہوئی", "Today's attendance has not started"),
                        started ? tr("اس branch کے لیے کوئی Talaba roster member نہیں ملا.",
                                "No Talaba roster members were found for this branch.")
                                : tr("Daily attendance session ابھی open نہیں ہوئی.",
                                "The daily attendance session is not open yet.")
                );
            } else {
                for (int i = 0; i < rows.length(); i++) {
                    JSONObject row = rows.optJSONObject(i);
                    if (row == null) continue;
                    LinearLayout item = card();
                    TextView name = tv(row.optString("name", "Talaba"), 15, GREEN_DARK, true);
                    name.setGravity(Gravity.RIGHT);
                    item.addView(name);

                    String number = row.optString("student_number", "—");
                    String source = row.optString("source", "").trim();
                    String detail = number + "  •  " + attendanceStatusLabel(row);
                    if (!source.isEmpty()) detail += "  •  " + source;
                    TextView meta = tv(detail, 11, MUTED, false);
                    meta.setGravity(Gravity.RIGHT);
                    LinearLayout.LayoutParams mp = new LinearLayout.LayoutParams(-1, -2);
                    mp.topMargin = dp(6);
                    item.addView(meta, mp);
                    content.addView(item, new LinearLayout.LayoutParams(-1, -2));
                    addGap(content, 8);
                }
            }

            sectionLabel(tr("بایومیٹرک ڈیوائسز", "Biometric devices"));
            deviceCard("BIO-01", "MBio G1", "Fingerprint device");
            deviceCard("BIO-02", "MBio G1", "Fingerprint device");
            deviceCard("BIO-03", "MBio G1", "Fingerprint device");
            deviceCard("BIO-04", "MBio G1", "Fingerprint device");

            sectionLabel(tr("ہنگامی صورت", "Emergency"));
            LinearLayout emergency = card();
            emergency.setBackground(rounded(BLUE_SOFT, BLUE_SOFT, 16));
            TextView emergencyTitle = tv(tr("ہنگامی دستی اندراج", "Emergency manual entry"), 14, BLUE, true);
            emergencyTitle.setGravity(Gravity.RIGHT);
            emergency.addView(emergencyTitle);
            TextView emergencyBody = tv(
                    tr("صرف اس وقت استعمال کریں جب biometric punch دستیاب نہ ہو.",
                            "Use only when a biometric punch is unavailable."),
                    11, MUTED, false);
            emergencyBody.setGravity(Gravity.RIGHT);
            LinearLayout.LayoutParams ep = new LinearLayout.LayoutParams(-1, -2);
            ep.topMargin = dp(5);
            emergency.addView(emergencyBody, ep);
            content.addView(emergency);
        });
    }

    private void deviceCard(String code, String deviceName, String detail) {
        LinearLayout deviceCard = card();
        LinearLayout line = row();
        deviceCard.addView(line);

        TextView badge = tv(code, 12, BLUE, true);
        badge.setGravity(Gravity.CENTER);
        badge.setPadding(dp(10), dp(8), dp(10), dp(8));
        badge.setBackground(rounded(BLUE_SOFT, BLUE_SOFT, 12));
        line.addView(badge, new LinearLayout.LayoutParams(dp(72), dp(36)));
        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.setPadding(dp(10), 0, 0, 0);
        line.addView(copy, new LinearLayout.LayoutParams(0, -2, 1f));

        TextView d = tv(deviceName, 14, TEXT, true);
        d.setGravity(Gravity.RIGHT);
        copy.addView(d);
        TextView s = tv(detail, 10, MUTED, false);
        s.setGravity(Gravity.RIGHT);
        copy.addView(s);

        TextView state = tv("Ready", 10, GREEN, true);
        state.setGravity(Gravity.CENTER);
        deviceCard.addView(state, new LinearLayout.LayoutParams(-1, dp(28)));
        LinearLayout.LayoutParams params =
                new LinearLayout.LayoutParams(-1, -2);
        params.bottomMargin = dp(8);
        content.addView(deviceCard, params);
    }

    private void renderHostel() {
        boolean english = englishMode();
        titleBlock(tr("ہاسٹل بوائز", "Hostel Boys"),
                tr("Learning program اور class / group کے ساتھ رہائشی طلبہ کا رجسٹر",
                        "Residential student register with learning program and class / group"));

        addActionCard(tr("طلبہ رجسٹر", "Students register"),
                tr("ہاسٹل کے طلبہ اسی permanent student records میں رہتے ہیں۔",
                        "Hostel boys remain the same permanent student records used by the Students section."),
                "talaba");

        String url = ClientConfig.API_BASE +
                "/api/mobile/hostel?tenantId=" + tenantId + "&branchId=" + branchId;
        NativeApi.get(url, accessToken, result -> {
            content.removeAllViews();
            titleBlock(tr("ہاسٹل بوائز", "Hostel Boys"),
                    tr("Learning program • class / group • student register",
                            "Learning program • class / group • student register"));

            if (!result.ok()) {
                addActionCard(tr("ہاسٹل ڈیٹا دستیاب نہیں", "Hostel data unavailable"),
                        tr("رہائشی طلبہ کا live رجسٹر ابھی حاصل نہیں ہو سکا۔",
                                "The live hostel boys register could not be loaded."));
                return;
            }

            JSONObject payload = NativeApi.json(result.body);
            JSONObject center = payload.optJSONObject("center");
            if (center == null) {
                addActionCard(tr("ہاسٹل ورک اسپیس خالی ہے", "Hostel workspace is empty"),
                        tr("کوئی student register response نہیں ملا۔",
                                "No student register response was returned."));
                return;
            }

            JSONArray students = center.optJSONArray("students");
            int studentCount = students == null ? 0 : students.length();

            ArrayList<String> programNames = new ArrayList<>();
            ArrayList<String> programNamesUr = new ArrayList<>();
            ArrayList<Integer> programCounts = new ArrayList<>();
            ArrayList<String> groupNames = new ArrayList<>();
            ArrayList<String> groupNamesUr = new ArrayList<>();
            ArrayList<Integer> groupCounts = new ArrayList<>();

            if (students != null) {
                for (int i = 0; i < students.length(); i++) {
                    JSONObject student = students.optJSONObject(i);
                    if (student == null) continue;

                    String program = student.optString("program_label", "Program");
                    String programUr = student.optString("program_label_ur", program);
                    int programIndex = programNames.indexOf(program);
                    if (programIndex < 0) {
                        programNames.add(program);
                        programNamesUr.add(programUr);
                        programCounts.add(1);
                    } else {
                        programCounts.set(programIndex, programCounts.get(programIndex) + 1);
                    }

                    String group = student.optString("group_label", "—");
                    String groupUr = student.optString("group_label_ur", group);
                    int groupIndex = groupNames.indexOf(group);
                    if (groupIndex < 0) {
                        groupNames.add(group);
                        groupNamesUr.add(groupUr);
                        groupCounts.add(1);
                    } else {
                        groupCounts.set(groupIndex, groupCounts.get(groupIndex) + 1);
                    }
                }
            }

            addMetricRow(tr("ہاسٹل طلبہ", "Hostel boys"), String.valueOf(studentCount),
                    tr("پروگرامز", "Learning programs"), String.valueOf(programNames.size()), true);
            addMetricRow(tr("کلاسز / گروپس", "Classes / groups"), String.valueOf(groupNames.size()),
                    tr("Students رجسٹر", "Students register"), String.valueOf(studentCount), false);

            JSONArray availableStudents = center.optJSONArray("available_students");
            if (availableStudents != null && availableStudents.length() > 0) {
                addActionCard(tr("موجودہ طالب علم شامل کریں", "Add existing student"),
                        tr("پہلے سے موجود Student کو Hostel Boys میں شامل کریں۔",
                                "Mark an existing student as a hostel boy without creating a duplicate."),
                        "hostel-add");
            }

            sectionLabel(tr("تعلیمی پروگرامز", "Learning programs"));
            if (programNames.isEmpty()) {
                addActionCard(tr("کوئی ہاسٹل طالب علم نہیں", "No hostel boys yet"),
                        tr("پہلے طالب علم کو Hostel Boys میں شامل کریں۔",
                                "Add a student to Hostel Boys to see the learning program here."));
            } else {
                for (int i = 0; i < programNames.size(); i++) {
                    String label = english ? programNames.get(i) : programNamesUr.get(i);
                    addActionCard(label,
                            programCounts.get(i) + " " + tr("طلبہ", "students"));
                }
            }

            sectionLabel(tr("کلاسز / گروپس", "Classes / groups"));
            for (int i = 0; i < groupNames.size(); i++) {
                String label = english ? groupNames.get(i) : groupNamesUr.get(i);
                addActionCard(label,
                        groupCounts.get(i) + " " + tr("طلبہ", "students"));
            }

            sectionLabel(tr("ہاسٹل طلبہ رجسٹر", "Hostel boys register"));
            if (studentCount == 0) {
                addActionCard(tr("رجسٹر خالی ہے", "Register is empty"),
                        tr("ابھی کوئی hostel student موجود نہیں۔",
                                "There are no hostel students in the current register."));
                return;
            }

            for (int i = 0; i < students.length(); i++) {
                JSONObject student = students.optJSONObject(i);
                if (student == null) continue;

                int personId = student.optInt("person_id", 0);
                LinearLayout item = card();
                if (personId > 0) {
                    item.setOnClickListener(v -> renderStudentDetail(personId));
                }

                LinearLayout top = row();
                item.addView(top);

                TextView number = tv(student.optString("student_number", "—"), 10, BLUE, true);
                number.setGravity(Gravity.CENTER);
                number.setPadding(dp(8), dp(6), dp(8), dp(6));
                number.setBackground(rounded(BLUE_SOFT, BLUE_SOFT, 10));
                top.addView(number, new LinearLayout.LayoutParams(dp(86), dp(36)));

                LinearLayout copy = new LinearLayout(this);
                copy.setOrientation(LinearLayout.VERTICAL);
                copy.setPadding(dp(10), 0, 0, 0);
                top.addView(copy, new LinearLayout.LayoutParams(0, -2, 1f));

                String name = student.optString("display_name", english ? "Student" : "طالب علم");
                TextView nameText = tv(name, 15, GREEN_DARK, true);
                nameText.setGravity(Gravity.RIGHT);
                copy.addView(nameText);

                String nativeName = student.optString("name_native", "").trim();
                if (!nativeName.isEmpty()) {
                    TextView nativeText = tv(nativeName, 11, MUTED, false);
                    nativeText.setGravity(Gravity.RIGHT);
                    copy.addView(nativeText);
                }

                String program = english
                        ? student.optString("program_label", "Program")
                        : student.optString("program_label_ur", student.optString("program_label", "پروگرام"));
                String group = english
                        ? student.optString("group_label", "—")
                        : student.optString("group_label_ur", student.optString("group_label", "—"));

                TextView meta = tv(program + "  •  " + group, 11, MUTED, false);
                meta.setGravity(Gravity.RIGHT);
                LinearLayout.LayoutParams metaParams = new LinearLayout.LayoutParams(-1, -2);
                metaParams.topMargin = dp(6);
                item.addView(meta, metaParams);
                Button remove = new Button(this);
                remove.setText(tr("ہاسٹل سے نکالیں", "Remove from hostel"));
                remove.setTextSize(11);
                remove.setTextColor(GREEN_DARK);
                remove.setAllCaps(false);
                remove.setMinHeight(dp(42));
                remove.setBackground(interactiveRounded(Color.WHITE, GREEN_SOFT, BORDER, 12));
                remove.setOnClickListener(v -> new AlertDialog.Builder(this)
                        .setTitle(tr("ہاسٹل سے نکالیں؟", "Remove from hostel?"))
                        .setMessage(tr(
                                "طالب علم Students میں موجود رہے گا، صرف رہائش Day ہو جائے گی۔",
                                "The student remains in Students; only the residence type changes to day."
                        ))
                        .setNegativeButton(tr("منسوخ", "Cancel"), null)
                        .setPositiveButton(tr("ہٹا دیں", "Remove"), (dialog, which) ->
                                setHostelResidenceNative(personId, "day"))
                        .show());
                LinearLayout.LayoutParams removeParams = new LinearLayout.LayoutParams(-1, -2);
                removeParams.topMargin = dp(8);
                item.addView(remove, removeParams);

                content.addView(item, new LinearLayout.LayoutParams(-1, -2));
                addGap(content, 8);
            }
        });
    }

    private void renderPortals() {
        titleBlock(tr("گارڈین و اساتذہ پورٹل", "Guardian & Teacher portals"),
                tr("Guardian Portal mandatory • Ustadh Portal",
                        "Guardian Portal • Ustadh Portal"));
        LinearLayout guardian = card();
        guardian.setBackground(rounded(GREEN_SOFT, GREEN, 18));
        TextView gt = tv("Guardian Portal", 18, GREEN_DARK, true);
        gt.setGravity(englishMode() ? Gravity.LEFT : Gravity.RIGHT);
        guardian.addView(gt);
        TextView gb = tv(
                parentChildren > 0
                        ? parentChildren + " " + tr("منسلک Talaba", "linked Talaba")
                        : tr("Linked Talaba، attendance، Hifz اور notices",
                                "Linked Talaba, attendance, Hifz and notices"),
                11, MUTED, false);
        gb.setGravity(englishMode() ? Gravity.LEFT : Gravity.RIGHT);
        guardian.addView(gb);
        content.addView(guardian);
        addGap(content, 8);
        addActionCard(tr("اساتذہ پورٹل", "Teacher portal"),
                tr("اپنے Talaba، attendance، Hifz اور notices",
                        "Assigned Talaba, attendance, Hifz and notices"),
                "staff");
        addActionCard(tr("گارڈین اطلاعات", "Guardian notices"),
                tr("اہم اطلاع اور student updates",
                        "Important notices and student updates"));
        addActionCard(tr("Talaba attendance", "Talaba attendance"),
                tr("حاضری اور حالیہ status", "Attendance and current status"),
                "attendance");
        addActionCard(tr("Hifz progress", "Hifz progress"),
                tr("حفظ کے متعلق parent-facing summary",
                        "Parent-facing Hifz summary"),
                "quran");
    }

    private void renderUstadh() {
        titleBlock(tr("اساتذہ", "Teachers"), tr("اساتذہ ورک اسپیس", "Teacher workspace"));
        addMetricRow(tr("اساتذہ", "Ustadh"), liveStaff,
                tr("برانچ", "Branch"), "1", true);
        addActionCard(tr("Ustadh directory", "Ustadh directory"),
                tr("اساتذہ کی profile اور بنیادی معلومات", "Teacher profiles and core information"),
                "staff");
        addActionCard(tr("Attendance", "Attendance"),
                tr("اپنی attendance اور assigned view", "Your attendance and assigned view"),
                "staff/attendance");
        addActionCard(tr("Classes & Talaba", "Classes & Talaba"),
                tr("متعلقہ class اور student workflow", "Assigned classes and students"),
                "my-students");
        addActionCard(tr("Leave", "Leave"),
                tr("Leave requests and status", "Leave requests and status"),
                "staff/leave");
    }

    private void renderDocuments() {
        titleBlock(tr("IDs و دستاویزات", "IDs & documents"),
                tr("Talaba ID cards اور certificates", "Talaba ID cards and certificates"));
        addActionCard(tr("Talaba ID cards", "Talaba ID cards"),
                tr("ID card batch generation", "Generate and print ID cards"),
                "students/id-cards");
        addActionCard(tr("Certificates", "Certificates"),
                tr("Talaba status / certificate workflow", "Student status and certificate workflow"),
                "documents");
        addActionCard(tr("Documents", "Documents"),
                tr("Talaba-linked documents", "Student-linked documents"),
                "documents");
    }
    private String reportLabel(JSONObject labels, String fallback) {
        if (labels == null) return fallback;
        return englishMode()
                ? labels.optString("en", labels.optString("ur", fallback))
                : labels.optString("ur", labels.optString("en", fallback));
    }

    private void renderReports() {
        titleBlock(tr("رپورٹس", "Reports"),
                tr("Operational reports • live report hub",
                        "Operational reports • live report hub"));
        addActionCard(tr("مکمل رپورٹس کھولیں", "Open full reports"),
                tr("محفوظ report workspace میں جائیں.", "Open the full reports workspace."));
        addActionCard(tr("رپورٹس لوڈ ہو رہی ہیں…", "Loading reports…"),
                tr("محفوظ published report catalogue حاصل کیا جا رہا ہے۔",
                        "Loading the published report catalogue."));

        String url = ClientConfig.API_BASE +
                "/api/mobile/reports?tenantId=" + tenantId + "&branchId=" + branchId;
        NativeApi.get(url, accessToken, result -> {
            content.removeAllViews();
            titleBlock(tr("رپورٹس", "Reports"),
                    tr("Operational reports • live report hub",
                            "Operational reports • live report hub"));

            if (!result.ok()) {
                addActionCard(tr("رپورٹس دستیاب نہیں", "Reports unavailable"),
                        tr("Published report hub ابھی حاصل نہیں ہو سکا۔",
                                "Published reports could not be loaded."));
                return;
            }

            JSONObject payload = NativeApi.json(result.body);
            JSONObject hub = payload.optJSONObject("reports");
            if (hub == null) {
                addActionCard(tr("رپورٹ hub خالی ہے", "Report hub is empty"),
                        tr("Report service نے کوئی response نہیں دیا۔",
                                "The report service returned no data."));
                return;
            }

            JSONArray reports = hub.optJSONArray("reports");
            JSONArray recent = hub.optJSONArray("recent_runs");
            int reportCount = reports == null ? 0 : reports.length();
            int recentCount = recent == null ? 0 : recent.length();
            addMetricRow(tr("Published reports", "Published reports"),
                    String.valueOf(reportCount),
                    tr("Recent runs", "Recent runs"), String.valueOf(recentCount), true);

            sectionLabel(tr("دستیاب رپورٹس", "Available reports"));
            if (reportCount == 0) {
                addActionCard(tr("کوئی published report نہیں", "No published reports"),
                        tr("اس workspace کے لیے کوئی report definition نہیں ملی.",
                                "No report definitions were found for this workspace."));
            } else {
                for (int i = 0; i < reportCount; i++) {
                    JSONObject report = reports.optJSONObject(i);
                    if (report == null) continue;
                    JSONObject labels = report.optJSONObject("labels");
                    String label = reportLabel(labels, report.optString("key", "Report"));
                    addActionCard(label,
                            report.optString("domain", "Operational") + "  •  " +
                                    tr("published", "published"),
                            "reports");
                }
            }

            if (recentCount > 0) {
                sectionLabel(tr("حالیہ رپورٹس", "Recent reports"));
                int shown = Math.min(recentCount, 6);
                for (int i = 0; i < shown; i++) {
                    JSONObject run = recent.optJSONObject(i);
                    if (run == null) continue;
                    JSONObject labels = run.optJSONObject("labels");
                    String label = reportLabel(labels, run.optString("report_key", "Report"));
                    addActionCard(label,
                            run.optString("state", "unknown") + "  •  rows: " + run.optInt("row_count", 0),
                            "reports");
                }
            }
        });
    }

    private void renderMore() {
        boolean english = englishMode();
        titleBlock(tr("مزید", "More"), tr("جامعہ کے باقی فعال ورک اسپیسز",
                "Everything else that is active in the workspace"));

        LinearLayout languageCard = card();
        languageCard.setBackground(gradient(GREEN_DARK, GREEN, 18));
        languageCard.setOnClickListener(v -> chooseLanguage());

        LinearLayout languageRow = row();
        languageRow.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        TextView langIcon = iconBubble("Aa", Color.rgb(225, 244, 234), GREEN_DARK);
        languageRow.addView(langIcon, new LinearLayout.LayoutParams(dp(40), dp(40)));

        LinearLayout langCopy = new LinearLayout(this);
        langCopy.setOrientation(LinearLayout.VERTICAL);
        langCopy.setPadding(dp(10), 0, 0, 0);
        languageRow.addView(langCopy, new LinearLayout.LayoutParams(0, -2, 1f));

        TextView langTitle = tv(tr("زبان", "Language"), 14, Color.WHITE, true);
        langCopy.addView(langTitle);
        TextView langValue = tv(
                english ? "English" : "اردو",
                10, Color.rgb(199, 233, 214), false);
        LinearLayout.LayoutParams langValueParams = new LinearLayout.LayoutParams(-1, -2);
        langValueParams.topMargin = dp(3);
        langCopy.addView(langValue, langValueParams);

        TextView langArrow = tv("→", 18, Color.WHITE, true);
        langArrow.setGravity(Gravity.CENTER);
        languageRow.addView(langArrow, new LinearLayout.LayoutParams(dp(28), dp(40)));
        languageCard.addView(languageRow);
        content.addView(languageCard);
        addGap(content, 10);

        addTwoLinks(tr("داخلہ", "Admissions"), "Admissions", "admissions",
                tr("اکیڈمکس", "Academic"), "Arabic + learning", "academics");
        addTwoLinks(tr("حفظ", "Qur’an & Hifz"), "Progress", "hifz",
                tr("امتحانات", "Exams & results"), "Results", "exams");
        addTwoLinks(tr("دستاویزات", "Documents"), "IDs + certificates", "documents",
                tr("گارڈین / اساتذہ", "Portals"), "Guardian + Ustadh", "portals");
        addTwoLinks(tr("اساتذہ", "Ustadh"), "Teacher workspace", "ustadh",
                tr("رپورٹس", "Reports"), "Operational reports", "reports");
        addTwoLinks(tr("سیٹنگز", "Settings"), "Institution", "settings",
                tr("Logout", "Sign out"), "Sign out from this device", "logout");
    }
    private void renderSettings() {
        boolean english = englishMode();
        titleBlock(tr("سیٹنگز", "Settings"),
                tr("کلائنٹ کنفیگریشن", "Client configuration"));
        addActionCard(
                english ? ClientConfig.INSTITUTION : ClientConfig.INSTITUTION_UR,
                ClientConfig.INSTITUTION + " • " + ClientConfig.ACADEMIC_YEAR);
        addActionCard(tr("ڈائریکٹر", "Director"),
                ClientConfig.DIRECTOR + " • " + ClientConfig.PHONE);
        addActionCard(tr("پتہ", "Address"), ClientConfig.ADDRESS);
        addActionCard(tr("پروگرامز", "Programs"), "Hifz • Arabic");
        addActionCard(tr("زبان", "Language"), english ? "English" : "اردو");
        addActionCard(tr("برانچ", "Branch"), "1 • " + ClientConfig.BRANCH);
    }

    private void addActionCard(String title, String subtitle) {
        boolean english = englishMode();
        LinearLayout item = row();
        item.setGravity(Gravity.CENTER_VERTICAL);
        item.setPadding(dp(14), dp(13), dp(14), dp(13));
        item.setLayoutDirection(english
                ? View.LAYOUT_DIRECTION_LTR
                : View.LAYOUT_DIRECTION_RTL);
        item.setBackground(rounded(Color.WHITE, BORDER, 18));
        item.setElevation(dp(1));

        ImageView bubble = iconBubbleIcon(R.drawable.il_icon_info, GREEN_SOFT, GREEN_DARK);
        item.addView(bubble, new LinearLayout.LayoutParams(dp(38), dp(38)));

        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.setPadding(dp(10), 0, 0, 0);
        item.addView(copy, new LinearLayout.LayoutParams(0, -2, 1f));

        TextView t = tv(title, 14, TEXT, true);
        t.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        copy.addView(t);

        TextView s = tv(subtitle, 10, MUTED, false);
        s.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.topMargin = dp(4);
        copy.addView(s, params);

        content.addView(item, new LinearLayout.LayoutParams(-1, -2));
        addGap(content, 8);
    }

    private boolean isSameScreenNativeAction(String path) {
        if ("exams".equals(currentScreen) && "exams".equals(path)) return true;
        if ("documents".equals(currentScreen)
                && ("documents".equals(path) || "students/id-cards".equals(path))) return true;
        if ("reports".equals(currentScreen) && "reports".equals(path)) return true;
        if ("hifz".equals(currentScreen)
                && ("quran".equals(path) || "quran/revision".equals(path))) return true;
        if ("academics".equals(currentScreen)
                && ("programs".equals(path) || "people-academics".equals(path))) return true;
        return "ustadh".equals(currentScreen)
                && ("staff".equals(path)
                || "staff/leave".equals(path)
                || "staff/attendance".equals(path)
                || "my-students".equals(path));
    }

    private void addActionCard(String title, String subtitle, String path) {
        if (isSameScreenNativeAction(path)) {
            addActionCard(title, subtitle);
            return;
        }
        boolean english = englishMode();
        LinearLayout item = row();
        item.setGravity(Gravity.CENTER_VERTICAL);
        item.setPadding(dp(14), dp(13), dp(12), dp(13));
        item.setLayoutDirection(english
                ? View.LAYOUT_DIRECTION_LTR
                : View.LAYOUT_DIRECTION_RTL);
        item.setBackground(interactiveRounded(Color.WHITE, GREEN_SOFT, BORDER, 18));
        item.setElevation(dp(1));
        item.setClickable(true);
        item.setFocusable(true);
        item.setContentDescription(title);
        item.setOnClickListener(v -> handleNativeAction(path));

        ImageView bubble = iconBubbleIcon(moduleIcon(path), GREEN_SOFT, GREEN_DARK);
        item.addView(bubble, new LinearLayout.LayoutParams(dp(38), dp(38)));

        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.setPadding(dp(10), 0, dp(7), 0);
        item.addView(copy, new LinearLayout.LayoutParams(0, -2, 1f));

        TextView t = tv(title, 14, TEXT, true);
        t.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        copy.addView(t);

        TextView s = tv(subtitle, 10, MUTED, false);
        s.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.topMargin = dp(4);
        copy.addView(s, params);

        ImageView arrow = new ImageView(this);
        arrow.setImageResource(R.drawable.il_icon_chevron);
        arrow.setColorFilter(GREEN_DARK);
        arrow.setScaleType(ImageView.ScaleType.CENTER);
        arrow.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        item.addView(arrow, new LinearLayout.LayoutParams(dp(38), dp(38)));

        content.addView(item, new LinearLayout.LayoutParams(-1, -2));
        addGap(content, 8);
    }

    private void loadRoleData() {
        if (tenantId <= 0 || accessToken.isEmpty()) {
            connectionState.setText(tr("آف لائن", "Offline"));
            connectionState.setTextColor(Color.rgb(177, 118, 32));
            return;
        }

        if ("parent".equals(surface)) {
            NativeApi.get(
                    ClientConfig.API_BASE +
                            "/api/mobile/portal/home?tenantId=" + tenantId +
                            "&surface=parent",
                    accessToken,
                    result -> {
                        if (!result.ok()) {
                            connectionState.setText(tr("غلطی", "Error"));
                            connectionState.setTextColor(Color.rgb(177, 118, 32));
                            return;
                        }
                        JSONObject payload = NativeApi.json(result.body);
                        guardianPayload = payload;
                        JSONArray children = payload.optJSONArray("children");
                        parentChildren = children == null ? 0 : children.length();
                        connectionState.setText(tr("آن لائن", "Online"));
                        connectionState.setTextColor(GREEN_DARK);
                        showScreen("home");
                    });
            return;
        }

        String url = ClientConfig.API_BASE +
                "/api/mobile/home?tenantId=" + tenantId +
                "&branchId=" + branchId;
        NativeApi.get(url, accessToken, result -> {
            if (!result.ok()) {
                connectionState.setText(tr("غلطی", "Error"));
                connectionState.setTextColor(Color.rgb(177, 118, 32));
                return;
            }
            JSONObject payload = NativeApi.json(result.body);
            JSONObject metrics = payload.optJSONObject("metrics");
            if (metrics != null) {
                JSONObject students = metrics.optJSONObject("students");
                JSONObject attendance = metrics.optJSONObject("attendance");
                JSONObject staff = metrics.optJSONObject("staff");
                JSONObject admissions = metrics.optJSONObject("admissions");

                if (students != null) {
                    int total = students.optInt("total", 0);
                    int active = students.optInt("active", 0);
                    liveStudents = active + " / " + total;
                }
                if (attendance != null) {
                    int present = attendance.optInt("present", 0);
                    int totalAttendance = attendance.optInt("total", 0);
                    liveAttendance = present + " / " + totalAttendance;
                }
                if (staff != null) {
                    int activeStaff = staff.optInt("active", 0);
                    int totalStaff = staff.optInt("total", 0);
                    liveStaff = activeStaff + " / " + totalStaff;
                }
                if (admissions != null) {
                    liveAdmissions = String.valueOf(admissions.optInt("open", 0));
                }
            }
            connectionState.setText(tr("آن لائن", "Online"));
            connectionState.setTextColor(GREEN_DARK);
            showScreen("home");
        });
    }

    @Override
    public void onBackPressed() {
        if (content == null) {
            super.onBackPressed();
            return;
        }
        showScreen("home");
    }
}
