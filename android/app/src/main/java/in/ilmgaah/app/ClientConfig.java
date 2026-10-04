package in.ilmgaah.app;

public final class ClientConfig {
    public static final String INSTITUTION = "Jamia Islamia Uloomul Quraan";
    public static final String INSTITUTION_UR = "جامعہ اسلامیہ علوم القرآن";
    public static final String SHORT_NAME_UR = "جامعہ اسلامیہ";
    public static final String DESCRIPTOR_UR = "حفظ • عربی تعلیم • رہائشی ہاسٹل";
    public static final String DIRECTOR = "Mufti Nooruddin Azami";
    public static final String PHONE = "9450825657";
    public static final String EMAIL = "uloomulquran@gmail.com";
    public static final String ADDRESS =
            "Martinganj Road, Kuriyawan, Phulpur, Uttar Pradesh, India";
    public static final String ACADEMIC_YEAR = "2026–2027";
    public static final String BRANCH = "Main Campus";

    // Debug builds use the public QA backend; release builds stay on production.
    public static final String API_BASE = BuildConfig.DEBUG
            ? "https://madarsa-erp-qa.vercel.app"
            : "https://www.ilmgaah.in";

    public static final String[] ACTIVE_MODULES = {
            "admissions", "talaba", "academics", "attendance", "biometric",
            "hifz", "exams", "guardian", "ustadh", "documents", "hostel", "reports"
    };

    private ClientConfig() {}
}
