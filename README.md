# Uy Bepul

Ilova haqida
Loyiha nomi
UBU Real Estate
Shior
"Har bir e'lon tasdiqlangan. Har bir bitim xavfsiz."
Butun ilova o'zbek tilida bo'lsin
Ilovaning barcha foydalanuvchi ko'radigan qismlari:
Menyu
Tugmalar
Matnlar
Forma
Xatoliklar
Bildirishnomalar
Dialog oynalari
Validatsiyalar
hammasi o'zbek (lotin) tilida bo'lsin.
Kod ichidagi:
variable
function
class
comment
ingliz tilida qolishi mumkin.

Ro'yxatdan o'tish Telefon raqami orqali OTP tasdiqlash. Har bir yangi foydalanuvchi oddiy User sifatida ro'yxatdan o'tadi. Agent bo'lish uchun alohida ariza yuboradi. Faqat Admin tasdiqlagandan keyingina Agent bo'ladi. Hech kim o'zini Agent qilib qo'ya olmaydi.

Rollar Tizimda faqat 3 ta rol mavjud. User Uylarni ko'radi Xaritadan qidiradi Filtrlaydi Sevimlilarga qo'shadi Uchrashuv bron qiladi Faqat IJARA e'loni joylay oladi SOTUV e'lonini joylay olmaydi. Admin tasdiqlasa Agentga aylanadi. Agent bo'lgandan keyin: Sotuv Ijara ikkalasini ham joylay oladi. Admin Admin quyidagilarni boshqaradi. Agentlarni tasdiqlaydi Agentlarni rad qiladi E'lonlarni tasdiqlaydi E'lonlarni rad qiladi Userlarni bloklaydi Userlarni boshqaradi Statistika ko'radi Hisobotlarni ko'radi Super Admin Super Admin Adminning barcha huquqlariga ega. Qo'shimcha ravishda: Admin yaratadi Adminni o'chiradi Tariflarni boshqaradi Premium narxlarini o'zgartiradi Platforma sozlamalarini boshqaradi Audit loglarni ko'radi

E'lon joylash Har bir e'lon quyidagilarni o'z ichiga olishi kerak: Rasmlar Narx Manzil GPS Xonalar soni Maydon Tavsif Sotuv yoki Ijara turi Oddiy User: Faqat IJARA joylay oladi. Agent: IJARA ham SOTUV ham joylay oladi. Har bir e'lon Admin tasdiqlagandan keyingina platformada chiqadi. 2-QISM

Sotuv va Ijara bo'limlari Sotuv va Ijara mutlaqo alohida ishlashi kerak. Sotuv sahifasi Faqat Sotuv e'lonlari ko'rinsin. Hech qachon ijara e'lonlari chiqmasin. Ijara sahifasi Faqat Ijara e'lonlari ko'rinsin. Hech qachon sotuv e'lonlari chiqmasin. Qidiruv (Search) Agar foydalanuvchi Sotuv bo'limida qidirsa: faqat Sotuv e'lonlari chiqishi kerak. Agar Ijara bo'limida qidirsa: faqat Ijara e'lonlari chiqishi kerak. Ikki turdagi e'lonlar bir-biriga aralashib ketmasin.

Agent tizimi Platformada foydalanuvchi hech qachon uy egasi bilan bog'lanmaydi. Har bir e'lon uchun quyidagilar ko'rinishi kerak: Agent rasmi Agent ismi Agentlik nomi Tasdiqlangan Agent belgisi (Verified Agent) Agent reytingi Muvaffaqiyatli bitimlar soni Uy haqida batafsil sahifa Uy sahifasida quyidagilar bo'lishi kerak: Rasmlar Narx Manzil Xarita Tavsif Xususiyatlari Agent haqida ma'lumot Asosiy tugma: Agent bilan bog'lanish Chat Agent bilan chat ochilganda avtomatik quyidagi xabar yozilsin: Assalomu alaykum. Men ushbu uyga qiziqib qoldim. Iltimos, batafsil ma'lumot bera olasizmi? Chatga avtomatik ravishda aynan qaysi uy haqida yozilayotgani biriktirilsin.

Batafsil ma'lumot uchun to'lov (Paywall) Bepul ko'rinadigan ma'lumotlar: Asosiy rasm Narx Taxminiy hudud Xonalar soni Maydon To'lov qilgandan keyin ochiladigan ma'lumotlar: Aniq manzil Xarita Barcha rasmlar To'liq tavsif Agent bilan bog'lanish Chat Agent reytingi Sharhlar Narxi: 11 990 so'm Har bir e'lon uchun alohida to'lanadi.

Premium obuna Narxi: 11 999 so'm / oy Premium foydalanuvchi quyidagi imkoniyatlarga ega bo'ladi: Cheksiz batafsil ma'lumotlarni ochish Kengaytirilgan filtrlar Sevimlilar Saqlangan qidiruvlar Yangi e'lonlar haqida bildirishnomalar Reklamalarsiz foydalanish (ixtiyoriy) Premium foydalanuvchi har safar 11 990 so'm to'lamaydi.

Agent profili Har bir tasdiqlangan Agent profilida quyidagilar bo'lishi kerak: Profil rasmi Ismi Agentlik nomi Reyting Sharhlar Muvaffaqiyatli bitimlar soni Tasdiqlangan Agent belgisi Faol e'lonlari 3-QISM (Yakuniy qism)

Admin panel Faqat Admin va Super Admin kira oladigan alohida Admin panel bo'lishi kerak. Oddiy foydalanuvchilar va Agentlar Admin panelni ko'rmasligi va kira olmasligi kerak. Admin quyidagi imkoniyatlarga ega bo'lsin: Agent bo'lish uchun yuborilgan arizalarni tasdiqlash yoki rad etish. Yangi e'lonlarni tasdiqlash yoki rad etish. Foydalanuvchilarni boshqarish. Kerak bo'lsa foydalanuvchilarni bloklash. Hisobotlar va statistikani ko'rish. Barcha to'lovlar tarixini ko'rish. Premium obunalarni boshqarish. 11 990 so'mlik batafsil ma'lumot xaridlarini kuzatish.

Super Admin panel Super Admin Adminning barcha huquqlariga ega bo'ladi. Qo'shimcha ravishda: Yangi Admin yaratish. Adminlarni o'chirish. Premium narxlarini o'zgartirish. Batafsil ma'lumot narxini o'zgartirish. Platforma sozlamalarini boshqarish. Audit loglarni ko'rish. Tizimdagi barcha faoliyatni nazorat qilish. Kelajakdagi yangilanishlar (Hozir qo'shilmaydi) Kod arxitekturasi shunday yozilsinki, keyinchalik quyidagi funksiyalarni oson qo'shish mumkin bo'lsin: Pasport (ID) tasdiqlash. Selfie (Liveness Check). Kadastr hujjatini tekshirish. Uy videolari. Takroriy rasmlarni aniqlash. Escrow (xavfsiz to'lov tizimi). Narx tarixi. 3D Tour. Elektron shartnoma. Onlayn bitim. Bu funksiyalarni hozir yaratma, faqat kelajakda qo'shish uchun tayyor arxitektura yarat. TEXNIK TALABLAR (ENG MUHIM QISM) ❗ Bu demo loyiha bo'lmasligi shart. ❗ Bu faqat dizayn yoki maket bo'lmasligi kerak. ❗ Bu production-ready (haqiqiy ishlaydigan) ilova bo'lishi shart. Quyidagilardan foydalanish taqiqlanadi: Demo ma'lumotlar. Fake API. Mock Data. Placeholder funksiyalar. Soxta e'lonlar. Sinov uchun yozilgan kod. Quyidagilar haqiqiy ishlashi shart: Haqiqiy ma'lumotlar bazasi. Haqiqiy OTP orqali ro'yxatdan o'tish. E'lonlarni bazaga saqlash. Yangi e'lonlar darhol barcha foydalanuvchilarga ko'rinishi. Chat real vaqt rejimida ishlashi. Agent tasdiqlash tizimi ishlashi. Admin tasdiqlash tizimi ishlashi. Rollar va ruxsatlar to'liq ishlashi. Premium obuna ishlashi. Batafsil ma'lumot uchun to'lov tizimi ishlashi. Sevimlilar ishlashi. Sharhlar ishlashi. Bron qilish tizimi ishlashi. Bildirishnomalar ishlashi. Ilova serverga joylashtirilgandan so'ng haqiqiy foydalanuvchilar darhol foydalanishi mumkin bo'lsin. Dizayn talablari Mavjud dizaynni buzma. Mavjud Emerald Green rang tizimini saqla. Responsive dizayn bo'lsin. Clean Architecture'dan foydalan. Qayta ishlatiladigan (Reusable) komponentlardan foydalan. Routing tizimini saqla. Ishlayotgan funksiyalarni o'chirma. Faqat yangi funksiyalarni qo'sh va mavjudlarini yaxshila. Yakuniy talab UBU Real Estate O'zbekistondagi professional ko'chmas mulk platformasi sifatida ishlab chiqilsin. Ilova demo yoki prototip emas, balki Play Store va App Store'ga chiqarishga hamda haqiqiy foydalanuvchilar foydalanishiga tayyor bo'lgan tijorat darajasidagi (Production Ready) ilova bo'lsin. Kod toza, xavfsiz, kengaytiriladigan va kelajakdagi yangilanishlarga tayyor yozilsin. Loyihani to'liq tahlil qil va ilovani ishga tushirishga xalaqit berayotgan barcha xatolarni tuzat.

Talablar:

- Barcha compile (build) xatolarini top va tuzat.

- Widgetlar orasidagi noto'g'ri bog'lanishlarni tuzat.

- Action, Navigation va Parameter xatolarini tuzat.

- Firebase, Supabase, API va Backend bilan bog'liq muammolarni aniqlab tuzat (agar mavjud bo'lsa).

- Null safety va data type mos kelmasligi xatolarini tuzat.

- Takroriy yoki bir-biriga zid kodlarni olib tashla.

- Custom Function va Custom Widgetlarning barchasi xatosiz ishlashini ta'minla.

- Ilovaning dizayni va funksiyalarini o'zgartirma, faqat xatolarni tuzat.

- Loyiha to'liq build bo'lib, hech qanday error yoki warning chiqarmaydigan holatga kelguncha tuzatishda davom et.

- Har bir tuzatilgan xato haqida qisqacha izoh ber va yakunda loyiha ishga tushishga tayyor ekanligini tekshir.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://uz-home-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/826e13d9-45d2-4b68-a4cd-11a19e514c67).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
