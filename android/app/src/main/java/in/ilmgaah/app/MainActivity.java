package in.ilmgaah.app;

import android.app.Activity;
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
    private static final int GREEN = Color.rgb(20, 115, 79);
    private static final int GREEN_DARK = Color.rgb(13, 90, 61);
    private static final int GREEN_SOFT = Color.rgb(234, 246, 240);
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
        showLogin();
    }

    private TextView languageToggle(boolean english) {
        TextView toggle = tv(english ? "اردو" : "English", 12, BLUE, true);
        toggle.setGravity(Gravity.CENTER);
        toggle.setPadding(dp(14), dp(9), dp(14), dp(9));
        toggle.setBackground(rounded(Color.WHITE, BLUE, 30));
        toggle.setClickable(true);
        toggle.setFocusable(true);
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

    private LinearLayout card() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(18), dp(16), dp(18), dp(16));
        card.setBackground(rounded(Color.WHITE, BORDER, 18));
        return card;
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
        LinearLayout outer = new LinearLayout(this);
        outer.setOrientation(LinearLayout.VERTICAL);
        outer.setBackgroundColor(BG);
        root.addView(outer, new FrameLayout.LayoutParams(-1, -1));

        LinearLayout header = row();
        header.setPadding(dp(16), dp(12), dp(16), dp(10));
        header.setBackgroundColor(Color.WHITE);
        header.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        outer.addView(header, new LinearLayout.LayoutParams(-1, dp(76)));

        TextView headerMark = tv("ج", 18, Color.WHITE, true);
        headerMark.setGravity(Gravity.CENTER);
        headerMark.setBackground(rounded(GREEN, GREEN, 12));
        header.addView(headerMark, new LinearLayout.LayoutParams(dp(46), dp(46)));

        LinearLayout headerCopy = new LinearLayout(this);
        headerCopy.setOrientation(LinearLayout.VERTICAL);
        headerCopy.setPadding(dp(12), 0, 0, 0);
        header.addView(headerCopy, new LinearLayout.LayoutParams(0, -2, 1f));

        headerTitle = tv(ClientConfig.SHORT_NAME_UR, 17, TEXT, true);
        headerTitle.setGravity(Gravity.RIGHT);
        headerCopy.addView(headerTitle);
        headerMeta = tv(ClientConfig.BRANCH + "  •  " + ClientConfig.ACADEMIC_YEAR,
                11, MUTED, false);
        headerMeta.setGravity(Gravity.RIGHT);
        headerCopy.addView(headerMeta);

        connectionState = tv("●", 16, GREEN, true);
        connectionState.setGravity(Gravity.CENTER);
        header.addView(connectionState, new LinearLayout.LayoutParams(dp(28), dp(46)));
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        outer.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1f));

        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(16), dp(16), dp(16), dp(24));
        content.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        scroll.addView(content);

        LinearLayout nav = row();
        nav.setPadding(dp(8), dp(5), dp(8), dp(7));
        nav.setBackgroundColor(Color.WHITE);
        outer.addView(nav, new LinearLayout.LayoutParams(-1, dp(74)));

        navItem(nav, "ہوم", "home");
        if ("parent".equals(surface)) {
            navItem(nav, "Talaba", "talaba");
            navItem(nav, "حاضری", "attendance");
            navItem(nav, "حفظ", "hifz");
        } else {
            navItem(nav, "Talaba", "talaba");
            navItem(nav, "حاضری", "attendance");
            navItem(nav, "ہاسٹل", "hostel");
        }
        navItem(nav, "مزید", "more");

        showScreen("home");
    }

    private void navItem(LinearLayout nav, String label, String screen) {
        TextView item = tv("•\\n" + label, 11, MUTED, true);
        item.setGravity(Gravity.CENTER);
        item.setLineSpacing(0, 0.9f);
        item.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        item.setOnClickListener(v -> showScreen(screen));
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
        headerTitle.setText(title);
        TextView h = tv(title, 26, TEXT, true);
        h.setGravity(Gravity.RIGHT);
        content.addView(h);
        TextView s = tv(subtitle, 12, MUTED, false);
        s.setGravity(Gravity.RIGHT);
        LinearLayout.LayoutParams params =
                new LinearLayout.LayoutParams(-1, -2);
        params.topMargin = dp(5);
        content.addView(s, params);
        addGap(content, 14);
    }
    private void sectionLabel(String text) {
        TextView view = tv(text, 14, GREEN_DARK, true);
        view.setGravity(Gravity.RIGHT);
        LinearLayout.LayoutParams params =
                new LinearLayout.LayoutParams(-1, -2);
        params.topMargin = dp(8);
        params.bottomMargin = dp(8);
        content.addView(view, params);
    }

    private LinearLayout metricCard(String label, String value, int fill, int valueColor) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(15), dp(14), dp(15), dp(14));
        card.setBackground(rounded(fill, fill == Color.WHITE ? BORDER : fill, 16));

        TextView small = tv(label, 11, fill == GREEN ? Color.WHITE : MUTED, true);
        small.setGravity(Gravity.RIGHT);
        card.addView(small);

        TextView large = tv(value, 25, valueColor, true);
        large.setGravity(Gravity.RIGHT);
        LinearLayout.LayoutParams params =
                new LinearLayout.LayoutParams(-1, -2);
        params.topMargin = dp(4);
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
    private TextView workspaceLink(String label, String subtitle, String screen) {
        TextView link = tv("", 14, TEXT, true);
        link.setPadding(dp(14), dp(13), dp(14), dp(13));
        link.setBackground(rounded(Color.WHITE, BORDER, 16));
        link.setGravity(Gravity.RIGHT);
        link.setOnClickListener(v -> showScreen(screen));

        String text = label + "\\n" + subtitle + "   ↗";
        link.setText(text);
        return link;
    }

    private void addTwoLinks(String label1, String sub1, String screen1,
                             String label2, String sub2, String screen2) {
        LinearLayout line = row();
        TextView one = workspaceLink(label1, sub1, screen1);
        TextView two = workspaceLink(label2, sub2, screen2);

        LinearLayout.LayoutParams p1 = new LinearLayout.LayoutParams(0, -2, 1f);
        LinearLayout.LayoutParams p2 = new LinearLayout.LayoutParams(0, -2, 1f);
        p1.setMargins(0, 0, dp(6), 0);
        p2.setMargins(dp(6), 0, 0, 0);
        line.addView(one, p1);
        line.addView(two, p2);
        content.addView(line);
        addGap(content, 8);
    }
    private void renderHome() {
        if ("parent".equals(surface)) {
            renderGuardianHome();
            return;
        }
        LinearLayout hero = card();
        hero.setBackground(rounded(Color.WHITE, BORDER, 20));
        TextView kicker = tv(
                roleLabel() + "  •  " + ClientConfig.ACADEMIC_YEAR,
                11, GREEN, true);
        kicker.setGravity(Gravity.RIGHT);
        hero.addView(kicker);

        TextView name = tv(ClientConfig.INSTITUTION_UR, 25, GREEN_DARK, true);
        name.setGravity(Gravity.RIGHT);
        LinearLayout.LayoutParams nameParams =
                new LinearLayout.LayoutParams(-1, -2);
        nameParams.topMargin = dp(6);
        hero.addView(name, nameParams);

        TextView desc = tv(
                "حفظ، عربی، طلبہ، حاضری اور رہائشی ہاسٹل کے لیے جامعہ ورک اسپیس",
                12, MUTED, false);
        desc.setGravity(Gravity.RIGHT);
        LinearLayout.LayoutParams descParams =
                new LinearLayout.LayoutParams(-1, -2);
        descParams.topMargin = dp(7);
        hero.addView(desc, descParams);

        TextView addr = tv(ClientConfig.ADDRESS, 10, MUTED, false);
        addr.setGravity(Gravity.RIGHT);
        LinearLayout.LayoutParams addrParams =
                new LinearLayout.LayoutParams(-1, -2);
        addrParams.topMargin = dp(10);
        hero.addView(addr, addrParams);

        content.addView(hero);
        addGap(content, 14);

        addMetricRow("فعال طلبہ", liveStudents,
                "بایومیٹرک", "4 × MBio G1", true);
        addMetricRow("اساتذہ", liveStaff,
                "برانچ", "1", false);
        sectionLabel("اہم ورک اسپیسز");
        addTwoLinks("داخلہ", "Admissions", "admissions",
                "طلبہ", "Talaba", "talaba");
        addTwoLinks("حاضری", "Biometric + emergency", "attendance",
                "ہاسٹل", "Hostel", "hostel");
        addTwoLinks("قرآن و حفظ", "Hifz register", "hifz",
                "اکیڈمکس", "Arabic + learning", "academics");
        addTwoLinks("امتحانات", "Results", "exams",
                "دستاویزات", "IDs + certificates", "documents");
        addTwoLinks("گارڈین و اساتذہ", "Portals", "portals",
                "رپورٹس", "Operational reports", "reports");

        LinearLayout info = card();
        info.setBackground(rounded(GREEN_SOFT, GREEN_SOFT, 16));
        TextView infoTitle = tv("صرف ضروری ماڈیولز", 14, GREEN_DARK, true);
        infoTitle.setGravity(Gravity.RIGHT);
        info.addView(infoTitle);

        TextView infoBody = tv(
                "Fees، Contributions، Payroll، Mess، AI اور WhatsApp اس client app میں شامل نہیں ہیں۔",
                11, MUTED, false);
        infoBody.setGravity(Gravity.RIGHT);
        LinearLayout.LayoutParams bodyParams =
                new LinearLayout.LayoutParams(-1, -2);
        bodyParams.topMargin = dp(6);
        info.addView(infoBody, bodyParams);
        content.addView(info);
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
        addMetricRow("کل طلبہ", liveStudents, "پروگرام", "Hifz + Arabic", true);

        sectionLabel("طلبہ کے کام");
        addActionCard("طلبہ رجسٹر", "تلاش، پروفائل اور بنیادی طالب علم معلومات");
        addActionCard("داخلہ سے طالب علم", "نئے طالب علم کو workflow کے ذریعے شامل کریں");
        addActionCard("شناخت اور دستاویزات", "ID card اور certificate workflows");
        addActionCard("گروپ / کلاس", "Hifz اور Arabic learning placement");
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
    private void renderAttendance() {
        titleBlock("حاضری", "صرف بایومیٹرک attendance اور ہنگامی manual punching");
        addMetricRow("بایومیٹرک", "4 مشینیں", "ڈیوائس", "MBio G1", true);

        sectionLabel("Biometric devices");
        deviceCard("BIO-01", "MBio G1", "Fingerprint device");
        deviceCard("BIO-02", "MBio G1", "Fingerprint device");
        deviceCard("BIO-03", "MBio G1", "Fingerprint device");
        deviceCard("BIO-04", "MBio G1", "Fingerprint device");

        sectionLabel("Emergency");
        LinearLayout emergency = card();
        emergency.setBackground(rounded(BLUE_SOFT, BLUE, 16));
        TextView emergencyTitle = tv("ہنگامی دستی اندراج", 14, BLUE, true);
        emergencyTitle.setGravity(Gravity.RIGHT);
        emergency.addView(emergencyTitle);
        TextView emergencyBody = tv(
                "صرف اس وقت استعمال کریں جب biometric punch دستیاب نہ ہو۔",
                11, MUTED, false);
        emergencyBody.setGravity(Gravity.RIGHT);
        LinearLayout.LayoutParams ep =
                new LinearLayout.LayoutParams(-1, -2);
        ep.topMargin = dp(5);
        emergency.addView(emergencyBody, ep);
        content.addView(emergency);
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
        titleBlock("ہاسٹل", "Residential hostel • رہائشی طلبہ اور room/bed operations");
        addMetricRow("رہائشی طلبہ", "—", "برانچ", "1", true);
        addMetricRow("Bed allocation", "—", "Rooms", "—", false);

        sectionLabel("ہاسٹل ورک اسپیس");
        addActionCard("Resident register", "رہائشی طلبہ کی موجودہ فہرست");
        addActionCard("Room & bed allocation", "کمرہ اور بستر allocation workflow");
        addActionCard("Visitor register", "Visitors اور identity record");
        addActionCard("Incidents", "Security incidents اور follow-up");
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
        titleBlock("رپورٹس", "Operational reports");
        addActionCard("Attendance report", "Student attendance summary");
        addActionCard("Hifz report", "Qur’an / Talaba Hifz progress");
        addActionCard("Admissions report", "Talaba admission pipeline summary");
        addActionCard("Hostel report", "Talaba resident and allocation overview");
        addActionCard("Exam report", "Talaba marks and published results");
    }

    private void renderMore() {
        titleBlock("مزید", "جامعہ کے باقی فعال ورک اسپیسز");
        addTwoLinks("داخلہ", "Admissions", "admissions",
                "اکیڈمکس", "Academic", "academics");
        addTwoLinks("حفظ", "Qur’an & Hifz", "hifz",
                "امتحانات", "Exams & Results", "exams");
        addTwoLinks("دستاویزات", "IDs + certificates", "documents",
                "گارڈین / اساتذہ", "Portals", "portals");
        addTwoLinks("اساتذہ", "Ustadh", "ustadh",
                "رپورٹس", "Reports", "reports");
        addTwoLinks("سیٹنگز", "Institution settings", "settings",
                "Logout", "Sign out", "logout");
    }
    private void renderSettings() {
        titleBlock("سیٹنگز", "Client configuration");
        addActionCard(ClientConfig.INSTITUTION_UR,
                ClientConfig.INSTITUTION + " • " + ClientConfig.ACADEMIC_YEAR);
        addActionCard("ڈائریکٹر",
                ClientConfig.DIRECTOR + " • " + ClientConfig.PHONE);
        addActionCard("پتہ", ClientConfig.ADDRESS);
        addActionCard("Programs", "Hifz • Arabic");
        addActionCard("Language", "Urdu primary");
        addActionCard("Branch", "1 • " + ClientConfig.BRANCH);
    }

    private void addActionCard(String title, String subtitle) {
        LinearLayout item = card();
        TextView t = tv(title, 14, TEXT, true);
        t.setGravity(Gravity.RIGHT);
        item.addView(t);

        TextView s = tv(subtitle, 11, MUTED, false);
        s.setGravity(Gravity.RIGHT);
        LinearLayout.LayoutParams params =
                new LinearLayout.LayoutParams(-1, -2);
        params.topMargin = dp(5);
        item.addView(s, params);

        LinearLayout.LayoutParams itemParams =
                new LinearLayout.LayoutParams(-1, -2);
        itemParams.bottomMargin = dp(8);
        content.addView(item, itemParams);
    }
    private void loadRoleData() {
        if (tenantId <= 0 || accessToken.isEmpty()) {
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
                            connectionState.setTextColor(Color.rgb(177, 118, 32));
                            return;
                        }
                        JSONObject payload = NativeApi.json(result.body);
                        guardianPayload = payload;
                        JSONArray children = payload.optJSONArray("children");
                        parentChildren = children == null ? 0 : children.length();
                        connectionState.setTextColor(GREEN);
                        showScreen("home");
                    });
            return;
        }

        String url = ClientConfig.API_BASE +
                "/api/mobile/home?tenantId=" + tenantId +
                "&branchId=" + branchId;
        NativeApi.get(url, accessToken, result -> {
            if (!result.ok()) {
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

                if (students != null && students.has("active") && students.has("total")) {
                    int total = students.optInt("total", 0);
                    int active = students.optInt("active", 0);
                    liveStudents = active + " / " + total;
                }
                if (attendance != null) {
                    int present = attendance.optInt("present", 0);
                    int totalAttendance = attendance.optInt("total", 0);
                    liveAttendance = totalAttendance > 0
                            ? present + " / " + totalAttendance
                            : "—";
                }
                if (staff != null && staff.has("active") && staff.has("total")) {
                    int activeStaff = staff.optInt("active", 0);
                    int totalStaff = staff.optInt("total", 0);
                    liveStaff = activeStaff + " / " + totalStaff;
                }
                if (admissions != null) {
                    liveAdmissions = String.valueOf(admissions.optInt("open", 0));
                }
            }
            connectionState.setTextColor(GREEN);
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
