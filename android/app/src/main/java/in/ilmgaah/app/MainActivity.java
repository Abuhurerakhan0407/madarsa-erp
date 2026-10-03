package in.ilmgaah.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

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

    private FrameLayout root;
    private LinearLayout content;
    private TextView headerTitle;
    private TextView headerMeta;
    private TextView connectionState;
    private Button signInButton;

    private String accessToken = "";
    private String surface = "admin";
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
        String[] options = {"اردو", "English"};
        new AlertDialog.Builder(this)
                .setTitle(tr("زبان منتخب کریں", "Choose language"))
                .setSingleChoiceItems(options, english ? 1 : 0, (dialog, which) -> {
                    dialog.dismiss();
                    setEnglishMode(which == 1);
                })
                .setNegativeButton(tr("منسوخ", "Cancel"), null)
                .show();
    }

    private TextView languageToggle(boolean english) {
        TextView toggle = tv(english ? "اردو" : "English", 12, BLUE, true);
        toggle.setGravity(Gravity.CENTER);
        toggle.setPadding(dp(14), dp(9), dp(14), dp(9));
        toggle.setBackground(rounded(Color.WHITE, BLUE, 30));
        toggle.setClickable(true);
        toggle.setFocusable(true);
        toggle.setOnClickListener(v -> chooseLanguage());
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
        button.setBackground(rounded(GREEN, GREEN, 14));
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
                new int[]{GREEN, GREEN, BLUE});
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

        TextView mark = tv("ج", 24, Color.WHITE, true);
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
        TextView c3 = pill(tr("ہاسٹل", "Hostel"), BLUE_SOFT, BLUE);
        TextView c4 = pill(tr("گارڈین", "Guardian"), BLUE_SOFT, BLUE);
        chips.addView(c1);
        chips.addView(c2);
        chips.addView(c3);
        chips.addView(c4);

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

        addGap(form, 14);
        signInButton = primaryButton(tr("سائن اِن", "Sign in"));
        form.addView(signInButton, new LinearLayout.LayoutParams(-1, dp(54)));

        TextView error = tv("", 12, Color.rgb(177, 45, 45), true);
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
            if (emailValue.isEmpty() || passwordValue.isEmpty()) {
                error.setText(tr("ای میل اور پاس ورڈ درج کریں۔",
                        "Enter your email and password."));
                return;
            }

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
                            if (accessToken.length() < 20) {
                                signInButton.setEnabled(true);
                                signInButton.setText(tr("سائن اِن", "Sign in"));
                                error.setText(tr("سائن اِن مکمل نہیں ہو سکا۔", "Sign-in could not be completed."));
                                return;
                            }
                            bootstrap(error);
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
    private void bootstrap(TextView error) {
        NativeApi.get(
                ClientConfig.API_BASE + "/api/mobile/bootstrap",
                accessToken,
                result -> {
                    if (!result.ok()) {
                        accessToken = "";
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
                        signInButton.setEnabled(true);
                        signInButton.setText(tr("سائن اِن", "Sign in"));
                        error.setText(tr("اس اکاؤنٹ کے لیے فعال ورک اسپیس نہیں ہے۔",
                                "This account has no active workspace."));
                        return;
                    }

                    surface = chosen.optString("surface", fallbackSurface);
                    tenantId = chosen.optInt("tenantId", 0);
                    branchId = chosen.optInt("branchId", 0);
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

        TextView headerMark = tv("ج", 19, Color.WHITE, true);
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
        outer.addView(nav, new LinearLayout.LayoutParams(-1, dp(78)));

        navItem(nav, tr("ہوم", "Home"), "home");
        navItem(nav, "Talaba", "talaba");
        navItem(nav, tr("حاضری", "Attendance"), "attendance");
        if ("parent".equals(surface)) {
            navItem(nav, tr("حفظ", "Hifz"), "hifz");
        } else {
            navItem(nav, tr("ہاسٹل", "Hostel"), "hostel");
        }
        navItem(nav, tr("مزید", "More"), "more");

        showScreen("home");
    }

    private String navGlyph(String screen) {
        if ("home".equals(screen)) return "⌂";
        if ("talaba".equals(screen)) return "◫";
        if ("attendance".equals(screen)) return "✓";
        if ("hostel".equals(screen)) return "▦";
        if ("hifz".equals(screen)) return "◒";
        return "•••";
    }

    private void navItem(LinearLayout nav, String label, String screen) {
        LinearLayout item = new LinearLayout(this);
        item.setOrientation(LinearLayout.VERTICAL);
        item.setGravity(Gravity.CENTER);
        item.setPadding(dp(4), dp(3), dp(4), dp(3));
        item.setBackground(rounded(MINT, 0, 15));
        item.setClickable(true);
        item.setFocusable(true);
        item.setOnClickListener(v -> showScreen(screen));

        TextView glyph = iconBubble(navGlyph(screen), GREEN_SOFT, GREEN_DARK);
        item.addView(glyph, new LinearLayout.LayoutParams(dp(34), dp(30)));

        TextView caption = tv(label, 10, MUTED, true);
        caption.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams captionParams = new LinearLayout.LayoutParams(-1, dp(24));
        captionParams.topMargin = dp(2);
        item.addView(caption, captionParams);

        nav.addView(item, new LinearLayout.LayoutParams(0, -1, 1f));
    }

    private String roleLabel() {
        if ("teacher".equals(surface)) return "Ustadh";
        if ("parent".equals(surface)) return "Guardian";
        return "Office";
    }
    private void showScreen(String screen) {
        if (content == null) return;
        content.removeAllViews();

        if ("home".equals(screen)) {
            headerTitle.setText(ClientConfig.SHORT_NAME_UR);
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
        else if ("logout".equals(screen)) showLogin();
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

        View rule = new View(this);
        rule.setBackgroundColor(BORDER);
        LinearLayout.LayoutParams ruleParams = new LinearLayout.LayoutParams(dp(48), dp(3));
        ruleParams.gravity = english ? Gravity.LEFT : Gravity.RIGHT;
        ruleParams.topMargin = dp(11);
        content.addView(rule, ruleParams);
        addGap(content, 13);
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
        link.setBackground(rounded(Color.WHITE, BORDER, 17));
        link.setElevation(dp(2));
        link.setClickable(true);
        link.setFocusable(true);
        link.setOnClickListener(v -> showScreen(screen));

        TextView bubble = iconBubble(navGlyph(screen), GREEN_SOFT, GREEN_DARK);
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

        TextView arrow = tv(english ? "→" : "←", 17, GREEN_DARK, true);
        arrow.setGravity(Gravity.CENTER);
        link.addView(arrow, new LinearLayout.LayoutParams(dp(25), dp(40)));

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
                tr("ہاسٹل", "Hostel"), "Beds + residents", "hostel");
        addTwoLinks(tr("قرآن و حفظ", "Qur’an & Hifz"), "Progress", "hifz",
                tr("اکیڈمکس", "Academic"), "Arabic + learning", "academics");
        addTwoLinks(tr("امتحانات", "Exams & results"), "Results", "exams",
                tr("دستاویزات", "Documents"), "IDs + certificates", "documents");
        addTwoLinks(tr("پورٹلز", "Portals"), "Guardian + Ustadh", "portals",
                tr("رپورٹس", "Reports"), "Operational reports", "reports");

        LinearLayout scope = card();
        scope.setBackground(rounded(MINT, MINT, 18));
        TextView scopeTitle = tv(tr("کلائنٹ ایپ کا دائرہ", "CLIENT APP SCOPE"),
                10, GREEN_DARK, true);
        scopeTitle.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        scope.addView(scopeTitle);

        TextView scopeBody = tv(
                tr("صرف فعال ضروری ماڈیولز۔ Fees، Contributions، Payroll، Mess، AI اور WhatsApp شامل نہیں۔",
                        "Only the required active modules. Fees, Contributions, Payroll, Mess, AI and WhatsApp are not included."),
                10, MUTED, false);
        scopeBody.setGravity(english ? Gravity.LEFT : Gravity.RIGHT);
        LinearLayout.LayoutParams scopeBodyParams = new LinearLayout.LayoutParams(-1, -2);
        scopeBodyParams.topMargin = dp(6);
        scope.addView(scopeBody, scopeBodyParams);
        content.addView(scope);
    }
    private JSONArray guardianChildren() {
        if (guardianPayload == null) return new JSONArray();
        JSONArray children = guardianPayload.optJSONArray("children");
        return children == null ? new JSONArray() : children;
    }

    private String childDisplay(JSONObject child) {
        String nativeName = child.optString("nativeName", "").trim();
        String name = child.optString("name", "Talaba").trim();
        return nativeName.isEmpty() ? name : nativeName + "  •  " + name;
    }

    private void renderGuardianHome() {
        titleBlock("Guardian Portal", "جامعہ کے Talaba، حاضری اور حفظ کی معلومات");
        addMetricRow("Linked Talaba", String.valueOf(parentChildren),
                "Academic year", ClientConfig.ACADEMIC_YEAR, true);

        sectionLabel("Talaba overview");
        JSONArray children = guardianChildren();
        for (int i = 0; i < children.length(); i++) {
            JSONObject child = children.optJSONObject(i);
            if (child == null) continue;
            int total = child.optInt("attendanceTotal30d", 0);
            int present = child.optInt("attendancePresent30d", 0);
            addActionCard(childDisplay(child),
                    "30-day attendance: " + present + " / " + total +
                            "  •  " + (child.optString("enrollmentStatus", "active")));
        }

        JSONObject overview = guardianPayload == null
                ? null : guardianPayload.optJSONObject("overview");
        if (overview != null) {
            JSONArray results = overview.optJSONArray("results");
            if (results != null && results.length() > 0) {
                sectionLabel("Recent result");
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
        titleBlock("Talaba", "Guardian Portal • linked students");
        JSONArray children = guardianChildren();
        if (children.length() == 0) {
            addActionCard("No linked Talaba", "اس اکاؤنٹ کے ساتھ کوئی طالب علم منسلک نہیں ہے۔");
            return;
        }
        for (int i = 0; i < children.length(); i++) {
            JSONObject child = children.optJSONObject(i);
            if (child == null) continue;
            LinearLayout item = card();
            TextView name = tv(childDisplay(child), 17, GREEN_DARK, true);
            name.setGravity(Gravity.RIGHT);
            item.addView(name);

            String program = child.optInt("groupId", 0) > 0
                    ? "Hifz / Arabic learning group linked"
                    : "Academic profile";
            TextView meta = tv(program, 11, MUTED, false);
            meta.setGravity(Gravity.RIGHT);
            LinearLayout.LayoutParams metaParams =
                    new LinearLayout.LayoutParams(-1, -2);
            metaParams.topMargin = dp(6);
            item.addView(meta, metaParams);

            TextView attendance = tv(
                    "حاضری (30 دن): " +
                            child.optInt("attendancePresent30d", 0) +
                            " / " + child.optInt("attendanceTotal30d", 0),
                    12, TEXT, true);
            attendance.setGravity(Gravity.RIGHT);
            LinearLayout.LayoutParams attendanceParams =
                    new LinearLayout.LayoutParams(-1, -2);
            attendanceParams.topMargin = dp(9);
            item.addView(attendance, attendanceParams);
            content.addView(item);
            addGap(content, 8);
        }
    }

    private void renderGuardianAttendance() {
        titleBlock("حاضری", "Guardian Portal • Talaba attendance");
        JSONArray children = guardianChildren();
        for (int i = 0; i < children.length(); i++) {
            JSONObject child = children.optJSONObject(i);
            if (child == null) continue;
            int total = child.optInt("attendanceTotal30d", 0);
            int present = child.optInt("attendancePresent30d", 0);
            addMetricRow(child.optString("name", "Talaba"),
                    present + " / " + total,
                    "Period", "30 days", i == 0);
        }
        addActionCard(
                "Biometric source",
                "Attendance shown from the existing Ilmgaah biometric attendance pipeline.");
    }

    private void renderGuardianHifz() {
        titleBlock("حفظ", "Guardian Portal • Hifz progress");
        JSONArray children = guardianChildren();
        for (int i = 0; i < children.length(); i++) {
            JSONObject child = children.optJSONObject(i);
            if (child == null) continue;
            LinearLayout item = card();
            TextView name = tv(childDisplay(child), 16, GREEN_DARK, true);
            name.setGravity(Gravity.RIGHT);
            item.addView(name);

            JSONObject quran = child.optJSONObject("latestQuran");
            String summary = "Hifz progress linked";
            if (quran != null) {
                String chapter = quran.optString("surah", "").trim();
                String juz = quran.optString("juz", "").trim();
                if (!chapter.isEmpty() || !juz.isEmpty()) {
                    summary = "Latest: " + chapter +
                            (juz.isEmpty() ? "" : "  •  Juz " + juz);
                }
            }
            TextView details = tv(summary, 11, MUTED, false);
            details.setGravity(Gravity.RIGHT);
            LinearLayout.LayoutParams detailsParams =
                    new LinearLayout.LayoutParams(-1, -2);
            detailsParams.topMargin = dp(6);
            item.addView(details, detailsParams);
            content.addView(item);
            addGap(content, 8);
        }
    }

    private void renderGuardianMore() {
        titleBlock("مزید", "Guardian Portal");
        addActionCard("Notices", "جامعہ کی اہم اطلاعات");
        addActionCard("Homework", "Assigned homework from the portal");
        addActionCard("Results", "Published examination results");
        addActionCard("Profile", ClientConfig.INSTITUTION_UR +
                " • " + ClientConfig.ACADEMIC_YEAR);
        addActionCard("Logout", "Sign out from Guardian Portal");
    }

    private void renderTalaba() {
        titleBlock("طلبہ", "Talaba register • جامعہ کے طلبہ کا روزمرہ ورک اسپیس");
        addActionCard("طلبہ رجسٹر لوڈ ہو رہا ہے…", "محفوظ live workspace data حاصل کیا جا رہا ہے۔");

        String url = ClientConfig.API_BASE +
                "/api/mobile/students?tenantId=" + tenantId +
                "&branchId=" + branchId +
                "&page=1&pageSize=30";
        NativeApi.get(url, accessToken, result -> {
            content.removeAllViews();
            titleBlock("طلبہ", "Talaba register • live workspace");

            if (!result.ok()) {
                addActionCard("طلبہ ڈیٹا دستیاب نہیں", "Live register ابھی حاصل نہیں ہو سکا۔ دوبارہ کھولیں۔");
                return;
            }

            JSONObject payload = NativeApi.json(result.body);
            int total = payload.optInt("total", 0);
            int active = payload.optInt("active", 0);
            addMetricRow("فعال طلبہ", String.valueOf(active), "کل طلبہ", String.valueOf(total), true);
            sectionLabel("Talaba register");

            JSONArray rows = payload.optJSONArray("rows");
            if (rows == null || rows.length() == 0) {
                addActionCard("ابھی کوئی Talaba نہیں", "اس branch میں موجودہ register خالی ہے۔");
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
                if (!nativeName.isEmpty()) {
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
        TextView back = tv("‹  طلبہ", 13, BLUE, true);
        back.setGravity(Gravity.RIGHT);
        back.setPadding(dp(4), dp(6), dp(4), dp(8));
        back.setOnClickListener(v -> showScreen("talaba"));
        content.addView(back, new LinearLayout.LayoutParams(-1, -2));
        titleBlock("طالب علم پروفائل", "Talaba • live profile");
        addActionCard("پروفائل لوڈ ہو رہی ہے…", "محفوظ live student record حاصل کیا جا رہا ہے۔");

        if (personId <= 0) {
            content.removeAllViews();
            titleBlock("طالب علم پروفائل", "Talaba");
            addActionCard("پروفائل دستیاب نہیں", "Student identifier درست نہیں ہے۔");
            return;
        }

        String url = ClientConfig.API_BASE +
                "/api/mobile/students/" + personId +
                "?tenantId=" + tenantId + "&branchId=" + branchId;
        NativeApi.get(url, accessToken, result -> {
            content.removeAllViews();
            TextView backLoaded = tv("‹  طلبہ", 13, BLUE, true);
            backLoaded.setGravity(Gravity.RIGHT);
            backLoaded.setPadding(dp(4), dp(6), dp(4), dp(8));
            backLoaded.setOnClickListener(v -> showScreen("talaba"));
            content.addView(backLoaded, new LinearLayout.LayoutParams(-1, -2));
            titleBlock("طالب علم پروفائل", "Talaba • live profile");

            if (!result.ok()) {
                addActionCard("پروفائل دستیاب نہیں", "Live student record ابھی حاصل نہیں ہو سکا۔");
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
            TextView name = tv(student.optString("name", "Talaba"), 22, GREEN_DARK, true);
            name.setGravity(Gravity.RIGHT);
            identity.addView(name);
            String nativeName = student.optString("nativeName", "").trim();
            if (!nativeName.isEmpty()) {
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
            number.setGravity(Gravity.RIGHT);
            LinearLayout.LayoutParams nump = new LinearLayout.LayoutParams(-1, -2);
            nump.topMargin = dp(9);
            identity.addView(number, nump);
            content.addView(identity);
            addGap(content, 10);

            addMetricRow("حاضری", attendance == null ? "—" : String.valueOf(attendance.optInt("present", 0)),
                    "غیر حاضر", attendance == null ? "—" : String.valueOf(attendance.optInt("absent", 0)), true);
            addMetricRow("تاخیر", attendance == null ? "—" : String.valueOf(attendance.optInt("late", 0)),
                    "کل ریکارڈ", attendance == null ? "—" : String.valueOf(attendance.optInt("total", 0)), false);

            sectionLabel("تعلیمی معلومات");
            addActionCard("پروگرام", student.optString("program", "—"));
            addActionCard("گروپ / کلاس", student.optString("group", "—"));
            addActionCard("حیثیت", student.optString("status", "—"));
            addActionCard("شمولیت", student.optString("joinedOn", "—"));

            sectionLabel("Module summary");
            int quranAttempts = payload.optInt("quranAttempts", 0);
            int resultCount = payload.optInt("resultCount", 0);
            addMetricRow("حفظ attempts", String.valueOf(quranAttempts),
                    "نتائج", String.valueOf(resultCount), false);
        });
    }

    private void renderAdmissions() {
        titleBlock("داخلہ", "Admissions workflow");
        addMetricRow("اوپن درخواستیں", liveAdmissions, "پروگرام", "Hifz + Arabic", true);
        sectionLabel("اہم مراحل");
        addActionCard("نیا داخلہ", "Walk-in یا online admission record");
        addActionCard("درخواست کی جانچ", "Review، decision اور follow-up");
        addActionCard("طالب علم میں تبدیلی", "Accepted admission → Talaba record");
    }
    private void renderAcademics() {
        titleBlock("اکیڈمکس", "حفظ اور عربی تعلیم کے لیے سادہ academic workspace");
        addActionCard("حفظ پروگرام", "روزانہ سبق، سبق دَور، revision اور progress");
        addActionCard("عربی پروگرام", "کلاس، مضمون اور نصاب کی بنیاد");
        addActionCard("ٹائم ٹیبل", "برانچ اور کلاس کے روزمرہ اوقات");
        addActionCard("Ustadh teaching view", "Ustadh کے لیے متعلقہ classes اور Talaba");
    }

    private void renderHifz() {
        titleBlock("قرآن و حفظ", "Hifz register • روزانہ کارکردگی اور revision");
        addMetricRow("پروگرام", "Hifz", "Revision", "روزانہ", true);
        addActionCard("روزانہ حفظ رجسٹر", "سبق، دَور اور recitation attempt");
        addActionCard("طلبہ کی پیش رفت", "طالب علم کی حفظ progress اور strength");
        addActionCard("Revision due", "جن طلبہ کی مراجعت باقی ہے");
        addActionCard("Ustadh review", "Ustadh کے لیے daily Hifz workflow");
    }

    private void renderExams() {
        titleBlock("امتحانات و نتائج", "Exams, marks and result records");
        addActionCard("Exam setup", "Exam series اور candidate roster");
        addActionCard("Marks", "Marks entry اور moderation");
        addActionCard("Results", "Published result view");
        addActionCard("Reports", "نتائج کی رپورٹنگ اور export");
    }
    private String todayIso() {
        return new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(new java.util.Date());
    }

    private String attendanceStatusLabel(JSONObject row) {
        String category = row.optString("status_category", "").trim();
        if ("present".equals(category)) return "حاضر";
        if ("absent".equals(category)) return "غیر حاضر";
        if ("late".equals(category)) return "تاخیر";
        if ("leave".equals(category) || "excused".equals(category)) return "رخصت";
        return "غیر نشان زدہ";
    }

    private void renderAttendance() {
        titleBlock("حاضری", "روزانہ student attendance • biometric pipeline");
        addActionCard("آج کی حاضری لوڈ ہو رہی ہے…", "Live roster اور attendance summary حاصل کی جا رہی ہے۔");

        String url = ClientConfig.API_BASE +
                "/api/mobile/attendance?tenantId=" + tenantId +
                "&branchId=" + branchId +
                "&date=" + todayIso() +
                "&view=student&page=1&pageSize=50";
        NativeApi.get(url, accessToken, result -> {
            content.removeAllViews();
            titleBlock("حاضری", "روزانہ student attendance • live workspace");

            if (!result.ok()) {
                addActionCard("حاضری ڈیٹا دستیاب نہیں", "Live attendance ابھی حاصل نہیں ہو سکی۔ دوبارہ کھولیں۔");
                return;
            }

            JSONObject payload = NativeApi.json(result.body);
            JSONObject attendance = payload.optJSONObject("attendance");
            if (attendance == null) {
                addActionCard("حاضری دستیاب نہیں", "Attendance service نے کوئی workspace response نہیں دیا۔");
                return;
            }

            JSONObject summary = attendance.optJSONObject("summary");
            int total = summary == null ? attendance.optInt("total", 0) : summary.optInt("total", 0);
            int present = summary == null ? 0 : summary.optInt("present", 0);
            int absent = summary == null ? 0 : summary.optInt("absent", 0);
            int late = summary == null ? 0 : summary.optInt("late", 0);
            int leave = summary == null ? 0 : summary.optInt("leave", 0);
            int unmarked = summary == null ? 0 : summary.optInt("unmarked", 0);

            addMetricRow("کل", String.valueOf(total), "حاضر", String.valueOf(present), true);
            addMetricRow("غیر حاضر", String.valueOf(absent), "تاخیر / رخصت", String.valueOf(late + leave), false);
            if (unmarked > 0) addActionCard("باقی غیر نشان زدہ", String.valueOf(unmarked) + " Talaba کی حاضری مکمل نہیں ہوئی۔");

            sectionLabel("Today's roster");
            JSONArray rows = attendance.optJSONArray("rows");
            if (rows == null || rows.length() == 0) {
                boolean started = attendance.optBoolean("started", false);
                addActionCard(
                        started ? "آج کا roster خالی ہے" : "آج کی حاضری شروع نہیں ہوئی",
                        started ? "اس branch کے لیے کوئی Talaba roster member نہیں ملا۔" : "Daily attendance session ابھی open نہیں ہوئی۔"
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

            sectionLabel("Biometric devices");
            deviceCard("BIO-01", "MBio G1", "Fingerprint device");
            deviceCard("BIO-02", "MBio G1", "Fingerprint device");
            deviceCard("BIO-03", "MBio G1", "Fingerprint device");
            deviceCard("BIO-04", "MBio G1", "Fingerprint device");

            sectionLabel("Emergency");
            LinearLayout emergency = card();
            emergency.setBackground(rounded(BLUE_SOFT, BLUE_SOFT, 16));
            TextView emergencyTitle = tv("ہنگامی دستی اندراج", 14, BLUE, true);
            emergencyTitle.setGravity(Gravity.RIGHT);
            emergency.addView(emergencyTitle);
            TextView emergencyBody = tv(
                    "صرف اس وقت استعمال کریں جب biometric punch دستیاب نہ ہو۔",
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
        titleBlock("ہاسٹل", "Residential hostel • live room and bed operations");
        addActionCard("ہاسٹل ڈیٹا لوڈ ہو رہا ہے…", "محفوظ live resident, bed اور security data حاصل کیا جا رہا ہے۔");

        String url = ClientConfig.API_BASE +
                "/api/mobile/hostel?tenantId=" + tenantId + "&branchId=" + branchId;
        NativeApi.get(url, accessToken, result -> {
            content.removeAllViews();
            titleBlock("ہاسٹل", "Residential hostel • live workspace");

            if (!result.ok()) {
                addActionCard("ہاسٹل ڈیٹا دستیاب نہیں", "Live hostel workspace ابھی حاصل نہیں ہو سکا۔");
                return;
            }

            JSONObject payload = NativeApi.json(result.body);
            JSONObject center = payload.optJSONObject("center");
            if (center == null) {
                addActionCard("ہاسٹل ورک اسپیس خالی ہے", "Hostel service نے کوئی center response نہیں دیا۔");
                return;
            }

            JSONArray beds = center.optJSONArray("beds");
            JSONArray students = center.optJSONArray("students");
            JSONArray allocations = center.optJSONArray("allocations");
            JSONArray visitors = center.optJSONArray("visitors");
            JSONArray incidents = center.optJSONArray("incidents");

            int bedCount = beds == null ? 0 : beds.length();
            int available = 0;
            int occupied = 0;
            if (beds != null) {
                for (int i = 0; i < beds.length(); i++) {
                    JSONObject bed = beds.optJSONObject(i);
                    if (bed == null) continue;
                    String state = bed.optString("state", "");
                    if ("available".equals(state)) {
                        available++;
                    } else if ("occupied".equals(state) || "allocated".equals(state) || "temporary_leave".equals(state)) {
                        occupied++;
                    }
                }
            }
            int residentCount = students == null ? 0 : students.length();
            int allocationCount = allocations == null ? 0 : allocations.length();
            int visitorCount = visitors == null ? 0 : visitors.length();
            int incidentCount = incidents == null ? 0 : incidents.length();

            addMetricRow("رہائشی طلبہ", String.valueOf(residentCount),
                    "کل beds", String.valueOf(bedCount), true);
            addMetricRow("Available", String.valueOf(available),
                    "Occupied", String.valueOf(occupied), false);

            sectionLabel("موجودہ رہائش");
            if (allocationCount == 0) {
                addActionCard("کوئی allocation نہیں", "اس branch میں موجودہ hostel allocation نہیں ملا۔");
            } else {
                int shown = Math.min(allocationCount, 12);
                for (int i = 0; i < shown; i++) {
                    JSONObject allocation = allocations.optJSONObject(i);
                    if (allocation == null) continue;
                    String room = allocation.optString("room_key", "—");
                    String bed = allocation.optString("bed_key", "—");
                    String resident = allocation.optString("display_name", "Talaba");
                    addActionCard(resident,
                            allocation.optString("student_number", "—") + "  •  " + room + " / " + bed +
                                    "  •  " + allocation.optString("state", "occupied"));
                }
            }

            sectionLabel("Security");
            addMetricRow("Visitors", String.valueOf(visitorCount),
                    "Incidents", String.valueOf(incidentCount), false);
            if (incidentCount > 0) {
                int shownIncidents = Math.min(incidentCount, 5);
                for (int i = 0; i < shownIncidents; i++) {
                    JSONObject incident = incidents.optJSONObject(i);
                    if (incident == null) continue;
                    addActionCard(
                            incident.optString("category", "Incident"),
                            incident.optString("resident_name", "Hostel resident") +
                                    "  •  " + incident.optString("severity", "normal") +
                                    "  •  " + incident.optString("state", "open"));
                }
            } else {
                addActionCard("کوئی active incident نہیں", "Current hostel incident feed میں کوئی record نہیں ملا۔");
            }
        });
    }

    private void renderPortals() {
        titleBlock("گارڈین و اساتذہ پورٹل", "Guardian Portal mandatory • Ustadh Portal");
        LinearLayout guardian = card();
        guardian.setBackground(rounded(GREEN_SOFT, GREEN, 18));
        TextView gt = tv("Guardian Portal", 18, GREEN_DARK, true);
        gt.setGravity(Gravity.RIGHT);
        guardian.addView(gt);
        TextView gb = tv(
                parentChildren > 0
                        ? parentChildren + " linked Talaba"
                        : "Linked Talaba، attendance، Hifz اور notices",
                11, MUTED, false);
        gb.setGravity(Gravity.RIGHT);
        guardian.addView(gb);
        content.addView(guardian);
        addGap(content, 8);
        addActionCard("Ustadh Portal", "اپنے Talaba، attendance، Hifz اور notices");
        addActionCard("Guardian notices", "اہم اطلاع اور student updates");
        addActionCard("Talaba attendance", "حاضری اور حالیہ status");
        addActionCard("Hifz progress", "حفظ کے متعلق parent-facing summary");
    }

    private void renderUstadh() {
        titleBlock("Ustadh", "اساتذہ workspace");
        addMetricRow("اساتذہ", liveStaff, "برانچ", "1", true);
        addActionCard("Ustadh directory", "اساتذہ کی profile اور بنیادی معلومات");
        addActionCard("Attendance", "اپنی attendance اور assigned view");
        addActionCard("Classes & Talaba", "متعلقہ class اور student workflow");
        addActionCard("Leave", "Leave requests and status");
    }

    private void renderDocuments() {
        titleBlock("ID و دستاویزات", "Talaba ID cards and certificates");
        addActionCard("Talaba ID cards", "ID card batch generation");
        addActionCard("Certificates", "Talaba status / certificate workflow");
        addActionCard("Documents", "Talaba-linked documents");
    }
    private void renderReports() {
        titleBlock("رپورٹس", "Operational reports • live report hub");
        addActionCard("رپورٹس لوڈ ہو رہی ہیں…", "محفوظ published report catalogue حاصل کیا جا رہا ہے۔");

        String url = ClientConfig.API_BASE +
                "/api/mobile/reports?tenantId=" + tenantId + "&branchId=" + branchId;
        NativeApi.get(url, accessToken, result -> {
            content.removeAllViews();
            titleBlock("رپورٹس", "Operational reports • live report hub");

            if (!result.ok()) {
                addActionCard("رپورٹس دستیاب نہیں", "Published report hub ابھی حاصل نہیں ہو سکا۔");
                return;
            }

            JSONObject payload = NativeApi.json(result.body);
            JSONObject hub = payload.optJSONObject("reports");
            if (hub == null) {
                addActionCard("رپورٹ hub خالی ہے", "Report service نے کوئی response نہیں دیا۔");
                return;
            }

            JSONArray reports = hub.optJSONArray("reports");
            JSONArray recent = hub.optJSONArray("recent_runs");
            int reportCount = reports == null ? 0 : reports.length();
            int recentCount = recent == null ? 0 : recent.length();
            addMetricRow("Published reports", String.valueOf(reportCount),
                    "Recent runs", String.valueOf(recentCount), true);

            sectionLabel("Available reports");
            if (reportCount == 0) {
                addActionCard("کوئی published report نہیں", "اس workspace کے لیے کوئی report definition نہیں ملی۔");
            } else {
                for (int i = 0; i < reportCount; i++) {
                    JSONObject report = reports.optJSONObject(i);
                    if (report == null) continue;
                    JSONObject labels = report.optJSONObject("labels");
                    String label = labels == null ? report.optString("key", "Report") : labels.optString("ur", labels.optString("en", report.optString("key", "Report")));
                    addActionCard(label, report.optString("domain", "Operational") + "  •  published");
                }
            }

            if (recentCount > 0) {
                sectionLabel("حالیہ رپورٹیں");
                int shown = Math.min(recentCount, 6);
                for (int i = 0; i < shown; i++) {
                    JSONObject run = recent.optJSONObject(i);
                    if (run == null) continue;
                    JSONObject labels = run.optJSONObject("labels");
                    String label = labels == null ? run.optString("report_key", "Report") : labels.optString("ur", labels.optString("en", run.optString("report_key", "Report")));
                    addActionCard(label,
                            run.optString("state", "unknown") + "  •  rows: " + run.optInt("row_count", 0));
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
        titleBlock(tr("سیٹنگز", "Settings"), tr("کلائنٹ کنفیگریشن", "Client configuration"));
        addActionCard(ClientConfig.INSTITUTION_UR,
                ClientConfig.INSTITUTION + " • " + ClientConfig.ACADEMIC_YEAR);
        addActionCard("ڈائریکٹر",
                ClientConfig.DIRECTOR + " • " + ClientConfig.PHONE);
        addActionCard("پتہ", ClientConfig.ADDRESS);
        addActionCard(tr("پروگرامز", "Programs"), "Hifz • Arabic");
        addActionCard(tr("زبان", "Language"), english ? "English" : "اردو");
        addActionCard(tr("برانچ", "Branch"), "1 • " + ClientConfig.BRANCH);
    }

    private void addActionCard(String title, String subtitle) {
        boolean english = englishMode();
        LinearLayout item = row();
        item.setGravity(Gravity.CENTER_VERTICAL);
        item.setPadding(dp(14), dp(13), dp(12), dp(13));
        item.setLayoutDirection(english
                ? View.LAYOUT_DIRECTION_LTR
                : View.LAYOUT_DIRECTION_RTL);
        item.setBackground(rounded(Color.WHITE, BORDER, 18));
        item.setElevation(dp(1));

        TextView bubble = iconBubble("•", GREEN_SOFT, GREEN_DARK);
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

        TextView arrow = tv(english ? "→" : "←", 17, GREEN_DARK, true);
        arrow.setGravity(Gravity.CENTER);
        item.addView(arrow, new LinearLayout.LayoutParams(dp(25), dp(38)));

        content.addView(item, new LinearLayout.LayoutParams(-1, -2));
        addGap(content, 8);
    }
    private void loadRoleData() {
        if (tenantId <= 0 || accessToken.isEmpty()) {
            connectionState.setText("آف لائن");
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
                            connectionState.setText("غلطی");
                            connectionState.setTextColor(Color.rgb(177, 118, 32));
                            return;
                        }
                        JSONObject payload = NativeApi.json(result.body);
                        guardianPayload = payload;
                        JSONArray children = payload.optJSONArray("children");
                        parentChildren = children == null ? 0 : children.length();
                        connectionState.setText("آن لائن");
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
                connectionState.setText("غلطی");
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
            connectionState.setText("آن لائن");
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
