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
    public static final String API_BASE = "https://www.ilmgaah.in";
    public static final String SUPABASE_URL =
            "https://dysfnytqpbfxpmerkyaz.supabase.co";
    public static final String SUPABASE_PUBLISHABLE_KEY =
            "sb_publishable_JE-qS9os44gw9TKy4GxYSA_5ZH_17H7";

    public static final String[] ACTIVE_MODULES = {
            "admissions", "talaba", "academics", "attendance", "biometric",
            "hifz", "exams", "guardian", "ustadh", "documents", "hostel", "reports"
    };

    private ClientConfig() {}
}
