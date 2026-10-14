# Öneri Algoritması İncelemesi (branch: stage-4-hard-filters)

Kapsam: `src/lib/recommender.ts`, `types.ts`, `recommender.test.ts`, `routes/suggest`, `routes/wardrobe/add`, `routes/calendar`, `routes/settings`.
`npm test`: 15 geçti, 1 kaldı (siyah+beyaz 69 < 78), 1 todo. Hiçbir kod değiştirilmedi.
Aşağıdaki maddeler kodu okuyarak doğrulandı; emin olunmayanlar "doğrulanmadı" diye işaretli.

## Özet: en önemli 5 bulgu

1. **Dış giyim sıcaklık <= heatThreshold olduğu sürece (örn. 24°C) her önerinin içine giriyor** (K1). Soğuk eşiği hiç kullanılmıyor. Etiketsiz ya da all-season bir mont 24°C'de her öneride çıkar.
2. **Ayakkabı / dış giyim / aksesuar seçimi tüm kombinlerde aynı** ve sadece hava skoruna göre, bağlı sonuçlarda "son eleman" kazanıyor (K2). 3 öneri yalnızca üst+alt olarak farklılaşıyor. Renk uyumu ve occasion hiç dikkate alınmıyor. Ayrıca "Generate"a tekrar basınca birebir aynı sonuç geliyor.
3. **En fazla 3 öneri ve aynı üst/alt tekrar edemiyor** (K3): 1-2 pantolonu olan kullanıcı 1-2 öneri görüyor, nedeni açıklanmıyor. Elbise için dış giyim Indoor/null durumunda filtreyi atlıyor.
4. **Geçmiş/tazelik mantığı ters ve yarı ölü** (K4): `recent_repeat_date` hiçbir yerde yazılmıyor; 60 günden eski kullanılmayan parça (0.4) hiç giyilmemişten (0.6) düşük puan alıyor; geçen hafta giyilen kombin sadece -15 puan kaybediyor; planlanıp giyilmeyen (is_worn=false) kombinler hiç sayılmıyor.
5. **Hava belirsizken (konum reddedildi / API hatası / "Generate" erken basıldı) sessizce dış giyim yasaklanıyor ve manuel sıcaklık girişi yok** (K5). Ayrıca sadece anlık saatin sıcaklığı kullanılıyor (gün min/max yok).

Not: kullanıcının sorduğu sınır durumu (`<= heat` vs `> hot`) birbirinin tam tümleyeni olduğu için **çelişki yok**; sorun o değil, yukarıdaki (1)'dir. Gerçek tutarsızlık Indoor + elbise yolunda (bkz. O3).

---

## KRİTİK

### K1. Dış giyim "heat eşiğinin altında her zaman" ekleniyor
- Konum: `recommender.ts:327-330` (+ `fitsWeather` 52, 62)
- Senaryo: Sıcaklık 24°C (heat=25, cold=15). Gardıropta etiketsiz/`all-season` bir kaban var. `fitsWeather` geçirir, `generateOutfitCombinations` `24 <= 25` olduğu için `bestOuterwear`'ı ekler. Üç önerinin üçünde de kaban çıkar. Test "allows a spring-fall jacket in mild weather" (20°C) bu davranışı sabitliyor. Tersine, 0°C'de uygun dış giyim yoksa (örn. sadece `summer` etiketli ceket) dış giyimsiz kombin uyarısız önerilir.
- Öneri: Dış giyimi "isteğe bağlı/zorunlu" ayır: `temp < coldThreshold` -> zorunlu (yoksa uyarı notu), `coldThreshold <= temp < coldThreshold+X` -> hafif ceket (spring-fall/etiketsiz), üstü -> yok. Kararı `fitsWeather` ile aynı yerde, tek bir fonksiyonda ver (şu an iki yerde ayrı mantık var).
- Aşama: 4 (hard filters).

### K2. Ayakkabı, dış giyim, aksesuar: tek seçim, bağlam-körü, belirsiz beraberlik
- Konum: `recommender.ts:311-313` (pickBest), `326-332`, `347-349`
- Detaylar (hepsi doğrulandı):
  - `pickBest(shoes, scoreWeatherNorm)` ve `pickBest(outerwear, ...)` üst/alt'a hiç bağlı değil: tüm kombinlerde aynı ayakkabı/dış giyim. Renk uyumu (`scoreShoeColorNorm`) sadece sonradan skorlanıyor, seçimi etkilemiyor. Yani siyah elbise için kırmızı ayakkabı seçilebilir.
  - Beraberlikte `>=` yüzünden **listedeki son eleman** kazanıyor. Mild havada (20°C) kışlık bot (0.7), yazlık sandalet (0.7), all-season spor ayakkabı (0.7) eşit: hangisinin çıkacağı DB sırasına bağlı. Mild'de `fitsWeather` hiçbir ayakkabıyı elemediği için 22°C'de kışlık bot + yazlık elbise çıkabilir.
  - Occasion yalnızca etiketliyse filtreleniyor; etiketsiz topuklu ayakkabı Sport'ta, bot Formal'de çıkabilir (bkz. O1).
  - `pickBest` her adımda `score()`'u iki kez çağırıyor ve nested loop içinde (üst*alt kez) yeniden hesaplanıyor; aksesuar hariç değerler üst/alt'tan bağımsız, döngü dışına alınabilir.
  - Tek aksesuar: eşarp + çanta + saat birlikte olamaz; aksesuar alt türü yok. Aksesuarın hava skoru seçimde yok (sadece renk).
  - Her "Generate" aynı girdi için birebir aynı çıktıyı veriyor (rastgelelik/çeşitlilik yok) -> kullanıcı "başka öner" diyemiyor.
- Öneri: Ayakkabı/dış giyim için ayrı bir "tamamlayıcı skor" (hava + renk uyumu + occasion + son giyilme) hesapla ve her üst+alt çifti için en iyiyi seç; beraberlikte deterministik ikinci kriter (son giyilme, id) ya da seçilmiş küçük rastgelelik. Hoistable seçimleri döngü dışına al.
- Aşama: 5 (scoring v2); beraberlik/occasion kısmı 4.

### K3. Sonuç sayısı sınırlaması ve ayrıştırma kuralı küçük gardıroplarda öneriyi öldürüyor
- Konum: `recommender.ts:362-384`; UI: `suggest/+page.svelte:134,286`
- Senaryo: 3 üst + 1 pantolon -> en fazla **1** öneri (reduce, aynı alt tekrar edemiyor; test "single pair of trousers" sadece `>0` bakıyor, bunu gizliyor). 2 pantolon -> en fazla 2. 3 öneri için en az 3 farklı üst ve 3 farklı alt gerekir. 3 limiti kodda sabit (`>= 3`), nedeni belgelenmemiş; UI'da "neden 3" bilgisi yok.
- Ayrıca: ilk `.filter` (dedupe, 364-375) anlamsız: her (üst, alt) çifti zaten benzersiz, elbiseler `id-undefined` ile benzersiz; O(n^2) boşa çalışıyor.
- Öneri: Çeşitlilik kuralını gevşet (en fazla 1 ortak parça + ceza ya da MMR benzeri), limiti parametre yap, ölü dedupe'u sil. Sonuç < 3 ise nedeni ver.
- Aşama: 5.

### K4. Geçmiş (tazelik) skoru: ters mantık, ölü alan, yetersiz ceza
- Konum: `recommender.ts:231-245`, `208-229`, `282-294`; `calendar/+page.svelte:185-194`
- Doğrulananlar:
  - `recent_repeat_date` yalnızca `types.ts` ve `recommender.ts`'te geçiyor; hiçbir yerde yazılmıyor -> `scoreHistoryNorm` ilk dalı ölü kod.
  - Skor eğrisi: ≤7 gün 0.1, ≤30 gün **1.0**, ≤60 gün 0.7, >60 gün 0.4, hiç giyilmemiş 0.6. Yani 3 aydır giyilmeyen parça, hiç giyilmemişten ve geçen ay giyilenden kötü puan alıyor. UI buna "Freshness" diyor; gardırop kullanım dengesi hedefiyle çelişiyor.
  - Geçen hafta giyilen kombin: h=0 -> en fazla -15 puan. Hava (28) + renk + desen ile toplam hâlâ birinci olabilir; hard filtre yok.
  - `confirmWorn` `last_worn_date`'i **bugün** yazıyor (entry tarihini değil): geçmiş bir günü sonradan "giyildi" işaretleme yanlış tarih verir. Ayakkabı/aksesuar geçmişi hiç cezalandırılmıyor (`coreItems` yalnızca üst/alt).
  - `last_worn_date` `new Date('YYYY-MM-DD')` UTC gece yarısı; `d<=7` sınırı gün-içi saatle kayabilir (saat dilimi, düşük etki).
  - Planlanmış ama giyilmemiş (is_worn=false) kombinler `wornHistory`'ye girmiyor: kullanıcı bir öneriyi takvime ekleyip tekrar Generate edince aynı kombin yine 1. çıkar. Önerinin hangi güne ait olduğu da seçilemiyor (hep bugünün havası).
  - Item güncellemeleri tek tek `await` ve hata kontrolsüz (`calendar:190-194`); kısmi yazma mümkün (düşük).
- Öneri: Tazelik = zamana göre monoton artan (uzun süredir giyilmeyen daha iyi), hiç giyilmemiş nötr/orta-yüksek; son N günde giyilen parça/kombini ya hard filtreyle ele ya da yüksek ağırlıkla cezalandır; `last_worn_date`'i entry tarihiyle yaz; `recent_repeat_date` ya kaldır ya doldur; planlı (is_worn=false) kayıtları ayrı değerlendir.
- Aşama: 3 (wear tracking) + 5.

### K5. Sıcaklık bilinmiyor / tek saatlik değer / manuel giriş yok
- Konum: `suggest/+page.svelte:34-47, 122-137, 272`; `recommender.ts:52`
- Doğrulananlar:
  - Konum reddedilirse ya da API hata verirse `temperature=null`: dış giyim her zaman yasak (kışın bile), diğer her şey geçer (yazlık top + kışlık bot). Kullanıcı sıcaklığı elle giremiyor.
  - `Generate` butonu yalnızca `loading`'e bağlı; hava gelmeden (`weatherLoading`) basılırsa null ile üretilir, sonra hava gelince öneriler yenilenmez (reaktif değil).
  - `apparent_temperature[hour]` yalnızca o anki saat; sabah 8°C / öğlen 24°C günü tek değer. Gün min/max, yağmur, rüzgâr yok. Tarayıcı saati ile `timezone=auto` konum saati farklıysa yanlış indeks (doğrulanmadı, VPN/seyahat durumu).
  - Boş sonuç mesajı ("Try adding more clean items or changing the occasion") hava filtresinin neden olduğunu söylemiyor.
- Öneri: Elle sıcaklık/hava seçici (Soğuk/Ilık/Sıcak), `weatherLoading` iken butonu kapat, null ise ay/mevsime düş, günlük min-max kullan, boş sonuçta nedenini döndür (test `it.todo` zaten bunu istiyor).
- Aşama: 4 (null davranışı) + 5 (sonuç şekli).

---

## ORTA

### O1. Occasion: etiketsiz parça her şeye uyuyor, eşleşme ödüllendirilmiyor
- Konum: `recommender.ts:68-70`; `wardrobe/add/+page.svelte:12` (varsayılan `occasions=[]`)
- Senaryo: Kullanıcı Formal seçer; etiketlemediği eşofman altı ve spor ayakkabı filtreden geçer. Etiketli (Formal) blazer ile etiketsiz tişört aynı puan alır (skor occasion'ı hiç kullanmıyor). Sadece Casual etiketli parçalar olan kullanıcı Formal'de boş sonuç alır.
- Öneri: Etiketli+eşleşen parçaya bonus, etiketsizi nötr/hafif ceza; add sayfasında etiket zorunlu/varsayılan olsun.
- Aşama: 4/5.

### O2. Mevsim etiketi varsayılan boş -> sert filtre fiilen devre dışı
- Konum: `wardrobe/add/+page.svelte:11`, `recommender.ts:55`
- Senaryo: Kullanıcı mevsim seçmeden kaydeder (`seasons=[]`), kışlık palto 30°C'de de çıkar (dış giyim hariç; elbise/üst/ayakkabı için filtre yok).
- Öneri: UI'da en az bir mevsim zorunlu ya da "all-season" varsayılan; kullanıcıya "etiketsiz parçalar filtrelenmiyor" göstergesi.
- Aşama: 4.

### O3. Elbise yolu ve Indoor tutarsızlığı
- Konum: `recommender.ts:346-360` vs `324-334`; `fitsWeather:46`
- Doğrulananlar:
  - Elbise dalında `temperature <= heatThreshold` kontrolü yok. Normalde `fitsWeather` zaten eler, ama **Indoor**'da `fitsWeather` hep `true` döndüğü için: Indoor + 35°C (ya da null) + elbise -> dış giyim eklenir; aynı koşulda üst+alt eklemez. Indoor + 10°C üst+alt'a ev içinde kaban eklenir. Indoor'da dış giyim hiç eklenmemeli (ya da tutarlı olmalı).
  - Elbiseye üst katman (hırka) / tayt / çorap yok; elbise skoru sabit: renk ana çifti 0.5 (`computeScore:264`), desen 0.75 -> elbiseler iyi renk uyumlu bir üst+alt çiftinden yapısal olarak düşük, kötü bir çiftten yüksek; sıralama adil değil. Elbisenin kendi deseni/ayakkabıyla uyumu dışında hiçbir çift-renk sinyali yok.
  - Elbise + üst+alt aynı listede yarışırken `is_patterned` elbise deseni ile ayakkabı/aksesuar arasında kontrol edilmiyor.
- Öneri: Dış giyim kararını tek yardımcı fonksiyona çıkar (Indoor dahil), elbise skorunu tarafsız/medyan değerle normalize et.
- Aşama: 4 (tutarlılık) + 5 (elbise skoru).

### O4. Ağırlıklar toplamı 100 ama skor aralığı sıkışık; 30 eşiği fiilen ölü
- Konum: `recommender.ts:296-299, 335, 352`
- Hesap: Ağırlıklar 40+30+15+15=100 (tutarlı). Ama: etiketsiz/all-season parça her havada 0.7 -> hava en çok 28/40 (null sıcaklıkta sabit 20). Hava, hard filtreden sonra pratikte "etiket özgüllüğü" bonusuna dönüşüyor. En kötü gerçekçi durum: hava 20 + renk ≥3 + desen ≥~8 + tazelik 0 ≈ 31 ≥ 30, yani eşik neredeyse hiç eleme yapmıyor; "Low" etiketi (<40) pratikte görünmez. Doğrulanmadı: soğukta sadece `spring-fall` (0.4) parçalarla <30 mümkün, nadir.
- Ayrıca hava skoru **tüm parçaların ortalaması**: bir ayakkabı/aksesuar eklemek (0.7) ortalamayı düşürür; ayakkabısı olan kullanıcının skorları ayakkabısı olmayandan düşük çıkar (örn. üst+alt 1.0, 1.0 + sandalet 0.7 -> 0.9).
- Öneri: Hava'yı hard filtre sonrası düşük ağırlığa çek ya da nötr (0.7→1.0 normalizasyonu), skoru yeniden dağıt (renk/uyum/tazelik/occasion), eşiği anlamlı kıl ya da kaldır, ortalama yerine yalnızca çekirdek parçalarla hesapla.
- Aşama: 5.

### O5. Renk skoru: nötrler ve çoklu renk
- Konum: `recommender.ts:119-148`; test `recommender.test.ts:129-138` (kalan başarısız test)
- Doğrulananlar:
  - `isNeutral` (`s<15 || l<15 || l>85`) -> herhangi bir nötr içeren çift 0.7. Siyah+beyaz = siyah+neon yeşil = 0.7; kontrast (kırmızı+turkuaz) 1.0. Test 69 vs 78'in sebebi bu.
  - Aynı tonda (hueDiff<15) ama doygunluk farkı ≥20 -> 0.5 (satır 128 koşulu sağlanmaz, 131 aralığı 15'ten başlar): monokrom ama farklı doygunlukta kıyafetler "nötr" 0.5.
  - Çoklu renk: tüm renk çiftlerinden **maksimum** (`best`) alınıyor -> çok renkli parça şans eseri 1.0 yakalar, çok renkli/desenli parçalar sistematik ödüllendirilir.
  - Pastel/açık renkler (l>85) ve koyu lacivert (l<15) nötr sayılıyor.
  - Bej/haki/gri için doygunluk eşiği 15 ise de hue yalnızca s>=15 için anlamlı; eşik ve L ayrımı tek değerle kaba.
  - Açık-koyu kontrastı (ton) hiç değerlendirilmiyor.
- Öneri: Nötr+nötr (klasik), nötr+canlı (güvenli), ton uyumu, kontrast için ayrı katmanlı skor; çoklu renkte ağırlıklı ortalama/baskın renk.
- Aşama: 5.

### O6. Ayakkabı renk skoru gri/bej ayakkabıda anlamsız hue kullanıyor
- Konum: `recommender.ts:164-180` (özellikle 167-168, 174)
- Senaryo: Gri spor ayakkabı (#808080) için s=0 -> `hexToHsl` h=0 döndürür (kırmızı hue). Satır 168 yalnızca lightness'a bakıyor, doygunluğa bakmıyor. Kırmızı pantolonla hueDiff=0 -> 0.9, yeşil pantolonla 0.65. Gri/bej/kum rengi ayakkabı ve gri alt için hue karşılaştırması anlamsız. `compareHexColors` bunu s<15 ile doğru ele alırken burada tutarsız.
- Öneri: Aynı `isNeutral` mantığını ortak kullan.
- Aşama: 5.

### O7. Aksesuar renk skoru: gümüş ölü, nötr dış katman "sıcak" sayılıyor
- Konum: `recommender.ts:187-206`
- Doğrulananlar:
  - 190. satır `s<20 || l<15 || l>85` -> 0.75 döndürüyor; `isSilver` ise `l>65 && s<25`. Klasik gümüş (#C0C0C0, s=0) 190'da çıkar, "Silver match" yalnızca s∈[20,25) olan nadir değerlerde tetiklenir. Gümüş eşleşmesi fiilen ölü.
  - `outfitHues` üst/alt'ın hue'sinden ortalama alıyor; nötr (siyah/beyaz/gri) için hue=0 -> "warm". Siyah+beyaz kombine gümüş takı 0.45 (ceza), altın 1.0 alıyor. Ortalama hue aritmetik: 5° ve 355° ortalaması 180° (soğuk) olur (dairesel ortalama değil).
  - Seçim tüm aksesuar kategorisini "takı metali" gibi ele alıyor (çanta, atkı, şapka, kemer). 
- Öneri: Nötrleri hue ortalamasından çıkar, gümüş kontrolünü 190'dan önce yap, aksesuarı alt türe ayır.
- Aşama: 5.

### O8. Desen skoru: "tek desenli" her zaman en iyi; tercih profili ters etkiyor; küçük örneklem
- Konum: `recommender.ts:150-156, 25-38`
- Doğrulananlar:
  - Bir desenli + bir düz = 1.0 (15 puan); iki düz = 0.65-0.85. En sade kullanıcıda (affinity 0) bile bir desenli parça düz+düz'den yüksek puan alır -> algoritma sürekli desenli parça önerir.
  - Çatışma yalnızca üst-alt arasında; dış giyim/ayakkabı/aksesuar/elbise deseni sayılmıyor (iki desenli üst + desenli elbise olmaz ama desenli ceket + desenli üst + desenli alt "tek çatışma" gibi).
  - `patternAffinity` tüm parçalar (ayakkabı, aksesuar dahil) üzerinden; 1 kayıtlı kıyafetle bile profil oluşuyor ("Clean & Minimal"), minimum örnek eşiği yok.
  - Aynı desen tipi (çizgili+çizgili) ve renkle uyum ayrımı yok.
- Öneri: Düz+düz'e tercih profiline göre puan ver, "çatışma"yı yalnızca iki desen için cezalandır, tüm giyilen parçalara bak, en az N kayıtta profil kullan.
- Aşama: 5/6.

### O9. Renk afinitesi bonusu tam hex eşitliği ile çalışıyor
- Konum: `recommender.ts:158-162, 31`; `suggest/+page.svelte:320`
- Senaryo: Afinite listesi geçmişte giyilen parçaların birebir `selected_color` hex'leri. Aynı hex'e başka bir parçanın sahip olması pratikte nadir (renk seçici/otomatik algı); bonus çoğunlukla **daha önce giyilen aynı parçalarda** tetiklenir -> tazelik hedefine ters, "Your palette" rozeti yanıltıcı. Bonus +3.6 puan/eşleşme (max 9), skor sıkışık aralıkta anlamlı.
- Öneri: Renkleri hue/lightness kovalarına yuvarla, sonra karşılaştır.
- Aşama: 6 (learning).

### O10. Mild aralıkta mevsim filtresi gevşek (heat/cold arası 10°C'ye kadar)
- Konum: `recommender.ts:59-63`
- Senaryo: 24°C'de `winter`-only kalın kazak, 16°C'de `summer`-only atlet geçiyor (sadece dış giyime özel kural var). `spring-fall` parça 38°C'de de geçer (0.6). Ayakkabı için (bot/sandalet) mild'de hiç ayrım yok (bkz. K2).
- Öneri: Üst/alt/ayakkabı için mild-tarafı "yumuşak" ceza; sınır +/- 3-5°C tampon.
- Aşama: 4/5.

### O11. cold > heat konfigürasyonu tanımsız davranış
- Konum: `settings/+page.svelte` (cold slider -10..20, heat slider 15..40), `recommender.ts:48-49, 59-60, 85-90`
- Senaryo: cold=20, heat=15 mümkün; 18°C'de hem `hot` hem `cold` true. `fitsWeather` ve `scoreWeatherNorm` `hot`'ı önce kontrol ettiği için "sıcak" kazanır; kullanıcıya hata/uyarı yok. (Ayarlar sayfasında doğrulama aramadım: doğrulanmadı, ama slider aralıkları örtüşüyor.)
- Öneri: Ayarlarda cold < heat zorunlu kıl ve `ctx` oluştururken normalize et (`Math.min`).
- Aşama: 4.

---

## DÜŞÜK

### D1. Performans
- Konum: `recommender.ts:324-334, 362-375`
- T*B çift için her seferinde O+S+A `pickBest` (çift `score` çağrısı) + O(n^2) `findIndex` dedupe. 100 üst x 50 alt = 5000 çift; dedupe ~12M callback, yüzlerce ms olabilir (doğrulanmadı, ölçülmedi). Dedupe zaten gereksiz (K3). Önce hoist + dedupe silme.
- Aşama: 5.

### D2. Büyük/küçük harf ve eski sayfa
- Konum: `routes/wardrobe/new/+page.svelte:14-16`
- Bu eski sayfa `Top`, `Summer`, `Autumn` gibi büyük harfli değerler yazıyor; öneri `category === 'top'` ve `seasons.includes('summer')` ile eşleşmiyor (parça hiç kategorilenmez; mevsim değeri boş-olmayan ama tanınmayan -> hem sıcakta hem soğukta elenir). Sayfaya link bulunamadı (`grep wardrobe/new` boş), muhtemelen artık kullanılmıyor. Eski kayıtlar için DB'de veri temizliği: doğrulanmadı.
- Aşama: 4 (veri normalizasyonu).

### D3. Geçersiz hex değerleri
- Konum: `recommender.ts:100-117`
- `#fff` (3 hane) veya `red` gibi değerlerde `parseInt` NaN -> karşılaştırmalar false -> çoğu yolda 0.5-0.65 döner, çökme yok; ama sessiz yanlış skor. Add sayfası `<input type=color>` kullandığı için pratikte 6 haneli (doğrulanmadı: eski kayıtlar).
- Aşama: 5.

### D4. `id` falsy kontrolü ve null alanlar
- Konum: `recommender.ts:381` (`topId && ...`) id=0 olursa atlanır (DB serial 1'den başlar, risk düşük). `item.category` tanımsız/boş parçalar hiçbir listeye girmez (sessizce yok sayılır).

### D5. Bildirilmeyen sonuç nedeni ve test boşlukları
- `generateOutfitCombinations` boş dizi dönüyor; nedeni yok (todo test). Eksik testler: dress + dış giyim/ayakkabı/Indoor, cold>heat, sınır sıcaklıklar (=heat, =cold), 1 pantolon + çok üst -> sonuç sayısı, history/recent_repeat (`checkCombinationHistory` hiç test edilmemiş), kirli parçalar (zaten sayfada `status='Clean'` ile elenir; recommender'a bağımlı değil), occasion etiketsiz davranışı.
- Kirli parça yönetimi: `suggest` yalnızca `Clean` çekiyor (`+page.svelte:88`); `Laundry`/`Drying` zaten elenir. Takvimdeki planlı kombin sonradan kirli olursa uyarı var (calendar); öneri sayfasında yok. Çok parçası kirli kullanıcıda 1 üst/1 alt kalınca öneri yok ve sebep söylenmiyor (K3, K5).

---

## Aşama eşlemesi

| Aşama | Maddeler |
|---|---|
| 4 (hard filters) | K1, K5 (null davranışı), O1, O2, O3 (tutarlılık), O10, O11, D2 |
| 5 (scoring v2) | K2, K3, K5 (sonuç şekli), O3, O4, O5, O6, O7, O8, D1, D3 |
| 3 (wear tracking) | K4 (last_worn tarihi, recent_repeat_date, planlı kayıtlar) |
| 6 (learning) | O8 (profil örneklemi), O9 |
