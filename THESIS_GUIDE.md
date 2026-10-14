# BSc Diploma Work – Kurallar ve Plan (PTE MIK, Computer Science Engineering)

Kaynak: fakültenin resmi belgeleri – `bscdiplomaworkformat.doc` (BSc format) ve `evaluation-sheet-2025.doc` (değerlendirme formu), https://info.mik.pte.hu/en/diploma-work

---

## 1. Zorunlu sayfalar (bu sırayla)
1. **Kapak** – üstte numara/yıl, ortada "DIPLOMA WORK", altta yazar adı ve yıl.
   - Sırtta: yazar adı, tez numarası, yıl.
   - Kapağın iç yüzüne küçük vesikalık fotoğraf yapıştırılır (basılı nüsha için; hâlâ geçerli mi, sor).
2. **Başlık sayfası** – University of Pécs / Faculty of Engineering and Information Technology / Computer Science Engineering Bachelor / DIPLOMA WORK / Başlık / Author / Supervisor / Pécs, yıl.
3. **Görev tanımı (Diploma Thesis specification)** – başlık + görevler, sorumlu bölüm, danışman; bölüm başkanı (Iványi) imzası. → Neptun'a kaydedilen başlık ve açıklama buraya girer.
4. **Beyan (Declaration)** – imzalı; fakültenin güncel `declaration-2025.docx` formu kullanılır.
5. **İçindekiler** (sayfa numaralı)
6. Ana metin (aşağıda)
7. **Summary**
8. **References**
9. **Appendix**

## 2. Ana metinde istenen konular ve bizim planla eşleşmesi
Format belgesindeki zorunlu konu listesi ve her birini neyle dolduracağımız:

| Belgedeki konu | Bizim tezdeki karşılığı | Kaynak malzeme |
|---|---|---|
| Introduction (short summary) | Problem: dolap dolu ama "ne giyeceğim"; hedef; tezin yapısı | En son yazılacak |
| Specification of the problems to solve | Uygulama ne yapmalı: gardırop, fotoğraf, öneri, takvim, çamaşır | `SCHEDULE.md`, proje planı commit'i (Şubat) |
| Analysis of the problem | Kombin önerisinin zorlukları: renk, hava, kişisel tarz, soğuk başlangıç | Bu konuşmadaki tartışmalar |
| Literature review, possible solutions | Whering vb. uygulamalar; ML (Han 2017, Vasileva 2018) vs bilgi tabanlı öneri (Burke, Felfernig); renk teorisi (Itten, Matsuda); MCDM/AHP (Saaty) | Kaynaklar doğrulanacak |
| Selection of the solution technique, explanations | Neden kural tabanlı/hibrit + MCDM; neden SvelteKit, Supabase, Cloudinary, Open-Meteo; alternatifler | Karar günlüğü |
| Detailed specification of the solution | Veri modeli; filtreler; puan formülü; stil tabloları; renk uyum tipleri | TASKS.md "Temel tasarım kararları" |
| Phases, experiences, problems during the work | **Kronolojik yolculuk** (Novak'ın istediği): Şubat–Nisan geliştirme + Ekim–Kasım iyileştirmeler; her adımda sorun → alternatifler → seçim | Git geçmişi, `KNOWN_ISSUES.md` |
| Explanation of the realization | Mimari, önemli kod parçaları (`recommender.ts`), ekranlar | Kod |
| Tests | Vitest senaryo testleri; önce/sonra sonuçları (ör. siyah–beyaz 69 < 78); kullanıcı testi | Aşama 0 test çıktısı |
| Analysis of the realization, application, further developments | Neyi iyi yapıyor, sınırlılıklar, gelecek çalışma | TASKS.md "Gelecek çalışma" |
| Summary | Kısa sonuç | — |

## 3. Biçim kuralları
- **En fazla 100 sayfa.** (Alt sınır yazmıyor – arkadaşlara sor.)
- A4; kenar boşlukları: üst 40 mm, alt 25 mm, sağ 25 mm, sol (cilt) 35 mm.
- Sayfa numarası: altta, ortada.
- Metin: Times New Roman 12 pt, 1,5 satır aralığı, iki yana yaslı.
- Başlıklar: Heading 1 → Arial 14 pt kalın; alt başlıklar → Arial 12 pt kalın. Başlıktan önce ve sonra boş satır; sonraki paragraf girintisiz.
- Sayfa üst bilgisi: tez başlığı veya bölüm başlığı.
- İçindekiler: numaralı (1, 1.1, 1.1.1); çok küçük parçalara bölme.
- **Şekiller:** ortalı; altında numara + açıklama; numaralama tüm tezde kesintisiz (bölüm numarası yok: "Figure 7", "Figure 2.3" değil); her şekle metinde atıf yapılmalı; A4'ten büyükler ekte.
- **Denklemler:** denklem düzenleyiciyle; ortalı; değişkenler italik, sayılar düz; önce/sonra boş satır. (Puan formülü ve AHP için gerekli.)

## 4. Alıntı ve kaynakça
- Her alıntı ve özetlenen fikir için köşeli parantezli numara: `[3]`.
- Birebir alıntı tırnak içinde; atlanan kısım "..." ile.
- Kaynaklar **ilk atıf sırasına göre** numaralanır (alfabetik değil).
- Web kaynağı: tam URL + son erişim tarihi.
- Örnek biçimler:
  - Kitap: `[1] Yazar, A.: Başlık. Yer, Yayınevi, yıl.`
  - Kitapta bölüm: `[2] Yazar: Bölüm. In: Kitap. Editör. Yer, Yayınevi, yıl. p. 13-24.`
  - Dergi: `[3] Yazar: Başlık. Dergi, yıl. vol. X, no. Y, pp. 220-228.`
  - Web: `[4] Yazar: Başlık. URL (last visited: tarih)`
- Kaynak gösterilmemesi = intihal.

## 5. Nasıl puanlanıyor (değerlendirme formu, toplam 50)
Hem danışman hem hakem ayrı ayrı doldurur.

| Kriter | Puan | Bizim için anlamı |
|---|---|---|
| 1. Yapılan iş ve çözümün kalitesi | 0–10 | 9–10 için müfredatın "çok ötesinde" bilgi: AHP, renk uyumu modeli, tarayıcıda ML ile arka plan silme, testler |
| 2. Problemin teorik ve mesleki temeli | 0–10 | Literatür + gerekçeli seçimler, "eleştirel düşünce" → ML vs kural tabanlı tartışması burada puan getirir |
| 3. Yapı ve mantıksal akış | 0–5 | Yukarıdaki konu sırasına uyan net yapı |
| 4. Üslup, dil, görünüm | 0–5 | Biçim kurallarına tam uyum, temiz İngilizce, kaliteli şekiller |
| 5. Bağımsız mühendislik işi: sonuçlar, özgünlük, uygulanabilirlik | 0–15 | **En büyük kalem.** 11–15 için "yeni ve özgün" sonuç: stile göre değişen renk uyumu, açıklanabilir öneri, önce/sonra ölçümleri; çalışan, deploy edilmiş uygulama |
| 6. Hakemin öznel değerlendirmesi | 0–5 | Genel izlenim |

- Notlar: **43–50 pekiyi**, 37–42 iyi, 31–36 orta, 25–30 geçer, 0–24 kaldı.
- **1–5 kriterlerinden herhangi birinde "unacceptable" (0) alırsan tez kabul edilmez.**

## 6. Teslim ve süreç (ders sayfası + Diploma work sayfası)
- Danışmanla **düzenli görüşme zorunlu**; %30'dan fazla devamsızlık dönem onayını riske atar.
- **Ön savunma (pre-defense) Aralık'ta** (2024'te 9 Aralık'tı) – bu yılın tarihini fakülte sitesinden takip et.
- Tez **danışman onayı olmadan teslim edilemez**; Neptun'a yükleme iznini danışman açar.
- Yüklenecekler: Neptun'a tez + doldurulmuş görev tanımı + imzalı beyan taraması; bölüm Moodle'ına tez metni (yüklenmezse teslim sayılmaz).
- Kaynak kod Neptun'a; büyükse link.
- **Çalışan uygulama** gerekli: hakem başka bilgisayarda çalıştırabilmeli → Vercel deploy + demo hesap.

## 7. Netleştirilecekler (arkadaşlara / fakülteye)
- [ ] Bu dönemin ön savunma ve son teslim tarihleri
- [ ] BSc için beklenen sayfa aralığı (üst sınır 100)
- [ ] Basılı nüsha ve vesikalık fotoğraf hâlâ isteniyor mu
- [ ] Görev tanımı sayfasını kim dolduruyor (danışman mı, öğrenci mi)
