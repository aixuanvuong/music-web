 TAI LIEU KY THUAT • KE HOACH TRIỂN KHAI • 26/10/2026



Kiến trúc và kế hoạch triển khai
website phát nhạc trực tiếp lấy
nguồn từ YouTube
Phát triển dựa trên dự án mã nguồn mở SimpMusic — tái sử dụng phần lõi đã kiểm
chứng, viết mới giao diện web và tầng phát nhạc cho trình duyệt.


 068d744                          2.4.0                       1.035 file                  GPL-3.0
 Commit nhánh dev đã              Phiên bản SimpMusic         Kotlin, ~175.900 dòng, 26   Giấy phép gốc
 phân tích                                                    module



   Kết luận cốt lõi, nói thẳng ngay từ đầu: Website này không phải việc "chuyển nguyên app
   SimpMusic lên web". Khoảng 60% độ khó — lấy dữ liệu và giải luồng phát từ YouTube Music — đã có
   sẵn trong module scraper chạy được trên JVM. Nhưng thành bại của toàn bộ dự án không nằm ở giao
   diện, mà nằm ở một phép thử kéo dài 1-3 ngày ở Giai đoạn 0: server của bạn có lấy và phát được
   luồng nhạc từ IP của chính nó hay không. Nếu phép thử đó thất bại vì YouTube chặn IP datacenter,
   mọi kế hoạch phía sau phải đổi hướng hoặc dừng lại.


Tài liệu này dành cho ai
Người quyết định có làm dự án hay không, và lập trình viên sẽ trực tiếp triển khai. Tài liệu phân biệt
rõ ba loại thông tin: [Đã kiểm chứng] — đọc trực tiếp từ code SimpMusic; [Đề xuất] — lựa chọn kiến
trúc do tài liệu này đưa ra; [Ước tính] — con số thời gian, chi phí, băng thông mang tính tham khảo,
không phải cam kết.
Nguồn gốc dự án: github.com/maxrave-dev/SimpMusic — Simple + Music, ứng dụng nghe nhạc đa nền tảng dùng
YouTube Music làm backend, tác giả maxrave-dev, thuộc SimpMusic.org. Tài liệu này là kế hoạch kỹ thuật cho mục
đích học tập / sử dụng cá nhân. Đọc kỹ Mục 8 về pháp lý trước khi quyết định triển khai công khai.




Website phát nhạc YouTube — Kiến trúc & Kế hoạch triển khai                                                Trang 1
Mục lục
 1. Tổng quan, mục tiêu và các quyết định kiến trúc chính
 2. Căn cứ tái sử dụng từ SimpMusic — dùng lại được gì, không dùng lại được gì

 3. Kiến trúc hệ thống và luồng dữ liệu

 4. Thiết kế stream proxy — thành phần quyết định
 5. Danh mục API đề xuất
 6. Dữ liệu và lưu trữ
 7. Rủi ro kỹ thuật và phép thử khả thi

 8. Pháp lý và giấy phép GPL-3.0
 9. Kế hoạch triển khai theo giai đoạn
10. Phụ lục: Ánh xạ module và checklist quyết định

1 Tổng quan, mục tiêu và quyết định chính

1.1 Mục tiêu sản phẩm
Xây dựng một website cho phép người dùng tìm kiếm, duyệt và phát nhạc lấy nguồn trực tiếp từ
YouTube Music ngay trong trình duyệt — với trải nghiệm gần với một app nghe nhạc thực thụ: trang
chủ gợi ý, tìm kiếm, trang album / nghệ sĩ / playlist, hàng đợi phát, lời nhạc đồng bộ và (ở giai đoạn
sau) playlist cá nhân.

1.2 Phạm vi

  MVP — làm trước, làm thật                                    Mở rộng — chỉ làm sau khi MVP ổn định

  Trang chủ, tìm kiếm, chi tiết bài hát / album / playlist /   Tài khoản người dùng, playlist tự tạo, yêu thích, lịch sử
  nghệ sĩ; phát nhạc liên tục, tua bài, hàng đợi, next /       nghe, đồng bộ đa thiết bị, nghe chung (Listen
  previous; lời nhạc; giao diện responsive cho desktop và      Together), thống kê cá nhân kiểu Wrapped, tải offline
  mobile web.                                                  qua PWA cache giới hạn.




Website phát nhạc YouTube — Kiến trúc & Kế hoạch triển khai                                                        Trang 2
1 Tổng quan (tiếp) — Sáu quyết định kiến trúc chính

 Quyết định                          Lựa chọn                                 Lý do

 D1. Backend bằng JVM /              Dùng lại scraper Kotlin của SimpMusic    Scraper đã có target jvm() [Đã kiểm
 Ktor                                trên server JVM                          chứng]. Viết lại bằng Node / Python
                                                                              đồng nghĩa viết lại toàn bộ logic
                                                                              Innertube, giải chữ ký và parser —
                                                                              phần khó nhất của dự án.

 D2. Frontend viết mới               React / Next.js (hoặc Vue / Nuxt tương   composeApp không có target
                                     đương)                                   Wasm / JS [Đã kiểm chứng]. Cố ép
                                                                              Compose lên web tốn công hơn viết
                                                                              mới và cho trải nghiệm kém hơn.

 D3. Luôn proxy luồng phát           Trình duyệt không bao giờ gọi thẳng      URL googlevideo gắn IP, có chữ ký,
                                     googlevideo                              hết hạn và không có CORS — gọi
                                                                              thẳng là không thể, không phải lựa
                                                                              chọn.

 D4. Không lưu file nhạc             Server chỉ proxy luồng theo thời gian    Giảm rủi ro pháp lý và chi phí lưu
                                     thực                                     trữ. Lưu file nhạc trên server biến
                                                                              dự án thành dịch vụ phân phối nội
                                                                              dung có bản quyền — một mức rủi
                                                                              ro hoàn toàn khác.

 D5. Spike trước, code sau           Giai đoạn 0 kiểm chứng stream từ IP      Đây là rủi ro có thể giết chết dự án.
                                     server trước mọi việc khác               Kiểm chứng nó trong 1-3 ngày rẻ
                                                                              hơn nhiều so với phát hiện sau 4
                                                                              tuần làm frontend.

 D6. Tách metadata và                API dữ liệu cache mạnh; stream không     Metadata (bài hát, album, lời) thay
 stream                              cache file, chỉ cache metadata           đổi chậm và cache được lâu. Luồng
                                                                              phát hết hạn theo giờ và gắn IP —
                                                                              cache file là sai cả về kỹ thuật lẫn
                                                                              pháp lý.


1.3 Nguyên tắc xuyên suốt
   Thẳng thắn về tính mong manh: Toàn bộ hệ thống phụ thuộc vào API không chính thức của
   YouTube Music. Nó sẽ gãy định kỳ khi YouTube đổi thuật toán. Kiến trúc phải coi "gãy stream" là sự
   kiện vận hành bình thường, có cảnh báo và quy trình sửa, không phải ngoại lệ hiếm.
   Một người, một phạm vi vừa: Kế hoạch ở Mục 9 được tính cho 1 lập trình viên. Mọi tính năng
   ngoài MVP đều phải trả lời được câu hỏi: nó có giúp chứng minh sản phẩm dùng được không?
   Không hứa hẹn ổn định kiểu sản phẩm thương mại: Với nguồn dữ liệu không chính thức,
   không cam kết uptime kiểu SLA với người dùng cuối.




Quyết định D1-D6 là xương sống của toàn bộ tài liệu                                                             Trang 3
2 Căn cứ tái sử dụng từ SimpMusic
[Đã kiểm chứng] Toàn bộ mục này dựa trên việc đọc trực tiếp mã nguồn SimpMusic, nhánh dev , commit 068d744 ,
phiên bản 2.4.0: 1.035 file Kotlin, khoảng 175.900 dòng, 26 module Gradle, kèm submodule core chứa phần lớn logic
lõi.


2.1 Dùng lại được — và đây là phần giá trị nhất

 Thành phần gốc                             Vai trò trong website

 core/service/kotlinYtmusicScraper          Lõi của backend. Module này đã có target jvm() trong build.gradle.kts .
 144 file Kotlin                            Ở source set jvmMain nó dùng PipePipeExtractor +
                                            BravePipeExtractor để trích xuất; ở commonMain nó dùng QuickJS
                                            (quickjs-kt) để chạy JavaScript player của YouTube và giải chữ ký luồng.
                                            Cung cấp: tìm kiếm, trang chủ, bảng xếp hạng, album, playlist, nghệ sĩ,
                                            gợi ý bài liên quan, thông tin luồng phát.

 core/domain                                Model dùng chung và khoảng 24 repository interface. Backend triển
                                            khai các interface này cho web; tên gọi và cấu trúc dữ liệu giữ nguyên để
                                            giảm việc dịch khái niệm.

 lyricsService                              Lấy lời nhạc đồng bộ — nguồn gồm SimpMusic Lyrics, LRCLIB và các
                                            nguồn mà service gốc đã tích hợp.

 spotify service                            Bổ sung metadata, lời nhạc và Canvas từ Spotify Web API khi cần (yêu
                                            cầu API key riêng, có giới hạn quota).



   Ý nghĩa thực tế: Phần việc mà một đội tự làm từ đầu thường mất nhiều tuần — giao tiếp API ẩn
   Innertube của YouTube Music, duy trì parser trước các thay đổi của YouTube, giải chữ ký stream — đã
   có sẵn và đang được cộng đồng SimpMusic duy trì. Đây là lý do duy nhất khiến dự án web này khả thi
   với 1 lập trình viên.




Website phát nhạc YouTube — Kiến trúc & Kế hoạch triển khai                                                     Trang 4
2 Căn cứ tái sử dụng (tiếp)

2.2 Không dùng lại được — phải viết mới hoặc bỏ

 Thành phần gốc                        Kết luận               Lý do / Thay thế

 composeApp (UI)                       Viết mới               Chỉ có target Android và JVM desktop, không có
 425 file, 33 màn hình, 30                                    target Wasm / JS. Frontend web viết mới bằng
 ViewModel                                                    React / Next.js, tham khảo luồng màn hình của app
                                                              gốc để thiết kế điều hướng.

 Player Android — Media3 /             Viết mới               Là code native Android. Web dùng phần tử audio
 ExoPlayer                                                    HTML5; tính năng nâng cao (gapless, crossfade) làm
 CrossfadeExoPlayerAdapter                                    bằng Web Audio API ở mức vừa đủ cho MVP.
 ~3.346 dòng

 Player Desktop — libmpv               Bỏ                     Native cho desktop, không liên quan tới trình duyệt.
 MpvPlayerAdapter ~3.306 dòng,                                Không port, không bọc lại.
 binding JNA

 Room database của app                 Tham khảo schema       Room là DB trên thiết bị. Website dùng PostgreSQL
 Version 27, 26 entity                                        ở server (Mục 6). Schema gốc hữu ích để tham khảo
                                                              cách mô hình hóa bài hát, playlist, lịch sử.

 Tính năng native                      Bỏ / làm sau           Android Auto, widget màn hình chính, Google Cast,
                                                              Discord Rich Presence, Last.fm scrobbling không
                                                              thuộc phạm vi web MVP.


2.3 Ba lưu ý khi tái sử dụng
1. Phụ thuộc sống còn vào upstream: Khi YouTube đổi thuật toán, bản sửa thường xuất hiện trước
   ở SimpMusic gốc. Cần quy trình theo dõi release / commit của upstream và cập nhật scraper định
   kỳ — đây là chi phí vận hành vĩnh viễn, không phải việc một lần.
2. Bleeding-edge dependencies: Dự án gốc dùng phiên bản thư viện rất mới (Kotlin, Compose,
   Material 3 alpha). Khi tách scraper ra chạy độc lập trên server, nên đóng băng phiên bản tại
   commit đã kiểm chứng, nâng cấp có kiểm soát thay vì bám theo bản mới nhất.
3. Kiểm thử mỏng ở dự án gốc: Chỉ khoảng 27 file test cho 1.035 file Kotlin. Phần backend web phải
   tự bổ sung test cho các điểm rủi ro nhất: parser kết quả tìm kiếm, resolve luồng và xử lý hết hạn
   URL.




Website phát nhạc YouTube — Kiến trúc & Kế hoạch triển khai                                                  Trang 5
3 Kiến trúc hệ thống

3.1 Sơ đồ thành phần [Đề xuất]


                                                         Người dùng
                                                Trình duyệt desktop / mobile

                                                         ↓ HTTPS ↓
             Frontend Web                                CDN / Static                           Reverse Proxy
              Next.js / React                       JS, CSS, ảnh giao diện                       Nginx / Caddy
     Player HTML5, hàng đợi, lời nhạc                Không chứa file nhạc                    HTTPS, giới hạn kết nối

                                 ↓ REST / JSON | Audio stream qua proxy ↓
      Backend API — Ktor (JVM)                          Stream Proxy                              Tác vụ nền
       Home, Search, Detail, Lyrics              Resolve URL, forward Range                 Làm mới cache, dọn phiên
     Auth, Playlist cá nhân, Rate limit         Chọn format, refresh khi 403                Cảnh báo khi scraper gãy

                                                               ↓
    kotlinYtmusicScraper                  PostgreSQL                         Redis                    Monitoring
     Module tái sử dụng từ            User, playlist tự tạo         Cache metadata &                Log, metrics, alert
           SimpMusic                 Yêu thích, lịch sử nghe            stream info               Prometheus / Grafana
     Innertube + QuickJS +                                          Rate limit, session             hoặc tương đương
            Extractor

                                               ↓ Chỉ từ IP của server ↓
               YouTube Music / googlevideo                                           LRCLIB / Spotify API
       API Innertube không chính thức + máy chủ phát                          Lời nhạc bổ sung, metadata phụ
                             luồng




Nguyên tắc bất biến: Mọi yêu cầu tới YouTube — cả metadata lẫn luồng phát — đều xuất phát từ IP
của server. Trình duyệt chỉ nói chuyện với domain của website. Không URL googlevideo nào được lộ
xuống client, vì URL đó gắn với IP server, hết hạn nhanh và không có CORS.




Website phát nhạc YouTube — Kiến trúc & Kế hoạch triển khai                                                               Trang 6
3 Kiến trúc hệ thống (tiếp) — Luồng dữ liệu

3.2 Luồng tìm kiếm và duyệt nội dung
1. Người dùng gõ từ khóa hoặc mở trang chủ trên frontend.
2. Frontend gọi GET /api/search?q=... hoặc GET /api/home tới Backend API.
3. Backend kiểm tra Redis: có kết quả còn hạn thì trả ngay (thường dưới 50 ms).
4. Chưa có cache: Backend gọi scraper, scraper gọi API Innertube của YouTube Music, phân tích kết
   quả thành model chuẩn của core/domain .
5. Backend chuẩn hóa dữ liệu (id, tiêu đề, nghệ sĩ, thời lượng, ảnh bìa), ghi cache Redis, trả JSON về
   frontend.
6. Frontend hiển thị danh sách. Ảnh bìa nên được proxy / cache qua domain của website để tránh lỗi
   hotlink và lộ thông tin không cần thiết.

3.3 Luồng phát một bài hát — quan trọng nhất
1. Người dùng bấm phát. Frontend không nhận URL YouTube; nó đặt nguồn cho trình phát là
    /api/stream/{videoId} trên chính domain của website.

2. Stream Proxy kiểm tra cache metadata luồng trong Redis theo videoId : URL googlevideo đã
   resolve, thời điểm hết hạn, danh sách format.
3. Chưa có hoặc sắp hết hạn: Proxy gọi scraper để resolve luồng mới — bằng IP của server — chọn
   format audio phù hợp (Mục 4.3), lưu metadata vào Redis với thời hạn ngắn hơn thời hạn URL một
   khoảng đệm an toàn.
4. Trình duyệt gửi yêu cầu kèm header Range (đặc biệt khi người dùng tua bài). Proxy forward
   nguyên vẹn Range lên googlevideo, nhận về 206 Partial Content cùng Content-Range , Content-Length ,
    Accept-Ranges và truyền thẳng về trình duyệt, không tải toàn bộ bài hát về server.

5. Nếu googlevideo trả 403 : Proxy xóa cache, resolve lại URL một lần duy nhất rồi thử lại. Vẫn 403 thì
   trả lỗi có cấu trúc về frontend, ghi log và tăng bộ đếm cảnh báo — đây là tín hiệu sớm của việc IP
   bị chặn hoặc YouTube đổi thuật toán.
6. Frontend phát qua HTML5 audio, cập nhật tiến trình, lời nhạc và hàng đợi. Khi hết bài, nó gọi bài
   tiếp theo trong hàng đợi — mỗi bài là một luồng proxy độc lập.


   Hệ quả phải chấp nhận: Vì luồng đi qua server, mọi byte nhạc người dùng nghe đều tiêu tốn băng
   thông server hai chiều (tải về từ googlevideo và tải lên cho người dùng, tùy nhà cung cấp VPS cách
   tính có thể chỉ tính chiều ra). Đây là chi phí cấu trúc của kiến trúc này — xem ước tính ở Mục 7.3.




Website phát nhạc YouTube — Kiến trúc & Kế hoạch triển khai                                              Trang 7
4 Thiết kế stream proxy chi tiết

4.1 Vì sao không có đường tắt

 Tính chất của URL googlevideo            Hệ quả bắt buộc

 Gắn với địa chỉ IP của bên đã            Ai resolve thì phải là người tải luồng đó. Server resolve thì server phải
 resolve                                  proxy.

 Có chữ ký, hết hạn sau vài giờ           Không lưu URL lâu dài, không đưa URL xuống client, phải có cơ chế resolve
                                          lại.

 Không có header CORS cho                 Trình duyệt chặn việc phát trực tiếp dù URL còn hạn.
 domain của website

 Yêu cầu header / thông số đi kèm         Proxy phải forward đúng header cần thiết và cập nhật theo thay đổi của
 tùy thời điểm                            YouTube qua scraper.


4.2 Yêu cầu thiết kế bắt buộc
   Streaming thực sự, không buffer toàn bài: Proxy truyền dữ liệu theo chunk ngay khi nhận được,
   giữ bộ nhớ trên mỗi kết nối ở mức nhỏ và không đổi theo độ dài bài hát.
   Forward Range đầy đủ: Hỗ trợ Range , trả đúng 206 , Content-Range , Accept-Ranges: bytes . Thiếu
   Range, người dùng không tua được và mỗi lần tua là tải lại từ đầu.
   Cache metadata, không cache file: Redis lưu theo videoId : URL đã resolve, thời điểm hết hạn,
   format đã chọn. Thời gian sống của cache đặt ngắn hơn thời hạn URL ít nhất 10-15 phút.
   Refresh có giới hạn khi 403: Mỗi yêu cầu chỉ resolve lại tối đa 1 lần. Lặp vô hạn khi bị chặn sẽ biến
   lỗi thành một cuộc tấn công tự gây ra vào quota của chính server.
   Giới hạn đồng thời và chống lạm dụng: Giới hạn số luồng đồng thời theo IP / tài khoản, giới hạn
   tốc độ resolve, timeout chặt cho kết nối treo. Endpoint stream là endpoint đắt nhất của hệ thống
   và là mục tiêu lạm dụng đầu tiên (người khác nhúng trộm vào web của họ).
   Bảo vệ endpoint: Yêu cầu token phiên ngắn hạn do backend cấp cho frontend trước khi phát,
   kiểm tra Referer / Origin như lớp phụ trợ. Không coi đây là bảo mật tuyệt đối — mục đích là ngăn
   sử dụng trộm thông thường.




Website phát nhạc YouTube — Kiến trúc & Kế hoạch triển khai                                                           Trang 8
4.3 Chọn định dạng audio [Đề xuất]

 Định dạng                 Trình duyệt                Chiến lược

 AAC trong MP4             Phát được trên             Mặc định ưu tiên. Tương thích rộng nhất, đặc biệt là Safari / iOS
 (~128-256 kbps tùy        Safari, Chrome,            — nơi Opus trong WebM không phát được qua phần tử audio
 nguồn)                    Firefox, Edge              thông thường.

 Opus trong WebM           Chrome, Firefox,           Dùng khi client báo hỗ trợ và cần tiết kiệm băng thông ở cùng
                           Edge tốt; Safari hạn       chất lượng cảm nhận. Phát hiện qua khả năng của trình duyệt,
                           chế                        không đoán theo User-Agent một cách cứng nhắc.

 Luồng muxed /             —                          Không dùng cho phát nhạc thuần. Tốn băng thông gấp nhiều lần
 video                                                cho phần hình người dùng không xem.


Khi cần hỗ trợ các trường hợp trình duyệt không phát được luồng gốc, phương án dự phòng là
chuyển mã (transcode) bằng FFmpeg ở server — nhưng chi phí CPU rất cao theo số người nghe đồng
thời. MVP không transcode; chỉ chọn trong số các format gốc mà YouTube trả về.

5 Danh mục API đề xuất

 Method & Path                                Mô tả                                         Cache / Giới hạn

  GET /api/home                               Trang chủ: mục gợi ý, phát hành mới,          Redis 15-30 phút
                                              bảng xếp hạng

  GET /api/search?q=&type=                    Tìm bài hát, album, nghệ sĩ, playlist; có     Redis 5-15 phút theo từ khóa
                                              phân trang

  GET /api/songs/:id                          Chi tiết bài hát, bài liên quan, gợi ý phát   Redis 30-60 phút
                                              tiếp

  GET /api/albums/:id                         Chi tiết album và danh sách bài               Redis 30-60 phút

  GET /api/playlists/:id                      Playlist công khai của YouTube Music          Redis 15-30 phút

  GET /api/artists/:id                        Nghệ sĩ, bài nổi bật, album                   Redis 30-60 phút

  GET /api/lyrics/:id                         Lời nhạc, ưu tiên lời đồng bộ theo thời       Redis / DB 24 giờ
                                              gian

  GET /api/stream/:id                         Stream proxy. Hỗ trợ Range, trả 206           Không cache file; metadata
                                                                                            30-120 phút; rate limit chặt
                                                                                            nhất

  POST /api/auth/* , /api/me/*                Đăng ký / đăng nhập, playlist cá nhân,        Không cache; xác thực bắt
                                              yêu thích, lịch sử — Giai đoạn 3              buộc


Quy ước chung: mọi lỗi trả JSON có code và message ; lỗi stream phân biệt rõ "hết hạn — đã thử làm mới" với "bị
chặn / nguồn lỗi" để frontend hiển thị đúng và monitoring đếm đúng. Rate limit áp theo IP cho khách và theo tài
khoản khi đã đăng nhập; vượt giới hạn trả 429 kèm Retry-After .




Website phát nhạc YouTube — Kiến trúc & Kế hoạch triển khai                                                          Trang 9
6 Dữ liệu và lưu trữ

6.1 Nguyên tắc phân chia

 Không lưu ở server — lấy trực tiếp mỗi lần / cache
                                                                 Lưu ở server
 tạm

 Catalog nhạc: bài hát, album, nghệ sĩ, playlist công            Dữ liệu do người dùng của website tạo ra: tài khoản,
 khai, kết quả tìm kiếm, trang chủ. Đây là dữ liệu của           playlist tự tạo (chỉ lưu danh sách videoId theo thứ tự),
 YouTube Music, thay đổi theo thời gian và theo khu              bài yêu thích, lịch sử nghe, hàng đợi đồng bộ, tùy chọn
 vực. Chỉ cache trong Redis có thời hạn, và lời nhạc có          phát (chất lượng ưu tiên, crossfade).
 thể cache lâu hơn trong cơ sở dữ liệu.



   Đường ranh đỏ: Server không lưu trữ file nhạc — không ghi luồng proxy xuống đĩa, không xây
   dựng kho nhạc riêng. Proxy chỉ truyền dữ liệu qua bộ nhớ trong lúc phát. Việc này vừa là yêu cầu
   pháp lý (Mục 8), vừa giữ chi phí lưu trữ ở mức tối thiểu.


6.2 Cấu phần lưu trữ [Đề xuất]

 Thành phần                     Vai trò

 PostgreSQL                     Nguồn sự thật cho user, playlist cá nhân, yêu thích, lịch sử. Quan hệ rõ ràng, sao lưu
                                đơn giản, đủ sức cho quy mô cá nhân tới vừa. Các bảng chính: users , playlists ,
                                playlist_items , favorites , listening_history , lyrics_cache .

 Redis                          Cache metadata API, cache thông tin luồng theo videoId , bộ đếm rate limit, phiên
                                đăng nhập và hàng đợi tác vụ nhẹ. Mất Redis không mất dữ liệu người dùng — hệ
                                thống chỉ chậm lại và phải resolve lại.

 Lưu trữ đối tượng (tùy         Chỉ cho ảnh đại diện người dùng hoặc ảnh bìa playlist tự tạo — không dùng cho
 chọn)                          nhạc.


6.3 Riêng tư và dữ liệu cá nhân
   Lịch sử nghe là dữ liệu nhạy cảm về sở thích cá nhân: chỉ lưu khi người dùng đăng nhập và đồng ý,
   cho phép xóa toàn bộ trong cài đặt.
   Không lưu cookie tài khoản YouTube của người dùng ở MVP. Tính năng đồng bộ tài khoản
   YouTube Music cá nhân (nếu làm ở giai đoạn mở rộng) phải được thiết kế riêng với mã hóa và
   cảnh báo rủi ro — không gộp vào kế hoạch này.
   Mật khẩu người dùng băm bằng thuật toán hiện hành (bcrypt / Argon2), không ghi log token,
   không ghi log URL googlevideo đầy đủ có chữ ký.




Website phát nhạc YouTube — Kiến trúc & Kế hoạch triển khai                                                        Trang 10
7 Rủi ro kỹ thuật — phần quyết định tính khả thi
Mục này viết thẳng, không làm nhẹ đi. Đây là những rủi ro có thật đã được cộng đồng các dự án
tương tự (client YouTube Music mã nguồn mở, Piped, Invidious) gặp lặp lại, không phải lo xa lý
thuyết.

 Rủi ro                           Mức độ            Diễn giải và cách đối phó

 IP datacenter bị chặn 403        Sống còn          YouTube phân biệt IP nhà dân và IP máy chủ thương mại. IP VPS /
                                                    cloud có nguy cơ cao bị trả 403, yêu cầu đăng nhập hoặc kiểm tra
                                                    bot ngay từ đầu hoặc sau một thời gian sử dụng. App SimpMusic
                                                    gốc ít gặp hơn vì chạy trên IP nhà của từng người dùng — lợi thế
                                                    đó mất hoàn toàn khi chuyển lên server tập trung.

 PO Token / BotGuard              Cao               YouTube ngày càng yêu cầu Proof-of-Origin Token được tạo trong
                                                    môi trường trình duyệt thật. Server không có trình duyệt thật sẽ
                                                    khó tạo token hợp lệ và bền vững; các giải pháp vòng thường gãy
                                                    theo chu kỳ ngắn.

 SABR và thay đổi giao            Cao               YouTube đang triển khai Server ABR (SABR) và thay đổi định kỳ
 thức                                               cách cấp luồng. Mỗi thay đổi có thể làm scraper gãy cho tới khi
                                                    upstream có bản sửa.

 Chi phí băng thông tăng          Trung bình        Không có CDN nào cache hộ luồng nhạc cho bạn. Người nghe
 tuyến tính                       — Cao khi         tăng gấp đôi thì băng thông tăng gấp đôi (Mục 7.3).
                                  đông người

 Phụ thuộc 1 upstream             Trung bình        SimpMusic do một tác giả chính duy trì (bus factor thấp). Nếu dự
                                                    án gốc chậm sửa, website kế thừa toàn bộ sự chậm đó.


7.1 Phép thử khả thi — Giai đoạn 0, làm trước mọi thứ khác
Mục đích: Trả lời một câu hỏi duy nhất bằng bằng chứng thật: từ IP của VPS dự định dùng, có resolve
và phát trọn vẹn được bài hát qua trình duyệt hay không, một cách lặp lại được?

   Dựng một backend tối thiểu (chỉ scraper + một endpoint stream), triển khai lên chính VPS / nhà
   cung cấp dự định dùng thật — thử trên máy cá nhân ở nhà không có giá trị, vì đó là IP nhà dân.
   Phát thử một danh sách đa dạng: bài phổ biến, bài ít người nghe, bài giới hạn độ tuổi / khu vực,
   phát liên tục nhiều giờ, tua bài ở nhiều vị trí.
   Lặp lại phép thử vào nhiều thời điểm trong 1-3 ngày, ghi lại tỷ lệ thành công, mã lỗi và độ trễ.




Website phát nhạc YouTube — Kiến trúc & Kế hoạch triển khai                                                     Trang 11
7.2 Tiêu chí pass / fail và các phương án B

 Kết quả spike                  Tiêu chí gợi ý [Đề xuất]                  Hành động

 PASS                           Phát thành công ≥ 95% số bài thử,         Đi tiếp Giai đoạn 1 theo đúng kiến trúc này.
                                gồm cả tua bài (206), lặp lại ổn định
                                qua 3 ngày, không xuất hiện yêu cầu
                                PO Token không giải được.

 PASS CÓ ĐIỀU KIỆN              Phát được nhưng chập chờn (80-            Chỉ triển khai ở quy mô cá nhân / nhóm nhỏ,
                                95%), hoặc chỉ một số nhóm nội dung       ghi rõ giới hạn cho người dùng, cân nhắc
                                bị lỗi.                                   một phương án B bổ trợ bên dưới.

 FAIL                           403 hàng loạt, bị yêu cầu kiểm tra bot    Dừng viết frontend. Chọn một phương án
                                / PO Token ngay từ đầu, hoặc thành        B hoặc dừng dự án. Viết giao diện đẹp cho
                                công < 80%.                               một hệ thống không phát được nhạc là lãng
                                                                          phí toàn bộ công sức.


Các phương án B khi spike thất bại hoặc xấu đi theo thời gian

 Phương án                            Đánh giá thẳng thắn

 Residential proxy (proxy IP          Khôi phục được lợi thế IP nhà dân, nhưng tốn phí theo GB — cộng dồn với băng
 nhà dân)                             thông streaming sẽ rất đắt, và độ ổn định phụ thuộc nhà cung cấp proxy. Chỉ
                                      hợp quy mô rất nhỏ.

 yt-dlp + nhà cung cấp PO             Cộng đồng lớn, cập nhật nhanh. Nhưng vẫn là cuộc chạy đua vũ trang với
 Token                                YouTube; PO Token provider là phụ thuộc bên thứ ba không đảm bảo lâu dài.

 Dùng instance Piped /                Nhanh để thử nghiệm, nhưng vi phạm điều khoản của nhiều instance nếu dùng
 Invidious công khai                  làm backend sản phẩm, độ ổn định không thuộc quyền kiểm soát của bạn.

 YouTube IFrame Player                Đúng điều khoản, ổn định, miễn phí băng thông. Đổi lại: có quảng cáo, branding
 chính thức                           YouTube, không tùy biến được trải nghiệm phát và phải tuân thủ chính sách của
                                      player chính thức. Đây là phương án duy nhất bền vững về pháp lý.

 Dừng / thu hẹp thành dùng            Chạy server trong mạng nhà (IP nhà dân) cho riêng mình dùng là kịch bản có tỷ
 cá nhân tại nhà                      lệ thành công cao nhất và rủi ro thấp nhất trong toàn bộ tài liệu này.




Website phát nhạc YouTube — Kiến trúc & Kế hoạch triển khai                                                      Trang 12
7.3 Ước tính băng thông [Ước tính]
Công thức nền: ở bitrate 128 kbps, một giờ nghe tiêu thụ khoảng 58 MB; ở 256 kbps, khoảng 115
MB. Băng thông chiều ra của server bằng tổng dung lượng mọi người dùng nghe được.

                                                      Tổng giờ nghe /   Dung lượng ở 128   Ở 256
 Kịch bản sử dụng
                                                      tháng             kbps               kbps

 Dùng cá nhân: 1 người, 2 giờ / ngày                  ~60 giờ           ~3,5 GB            ~7 GB

 Nhóm nhỏ: 10 người, 1 giờ / ngày                     ~300 giờ          ~17 GB             ~35 GB

 100 người dùng thường xuyên, 1 giờ / ngày            ~3.000 giờ        ~173 GB            ~346 GB

 1.000 người dùng thường xuyên, 1 giờ /               ~30.000 giờ       ~1,7 TB            ~3,5 TB
 ngày


Số người nghe đồng thời quyết định băng thông tức thời cần thiết: 100 người nghe cùng lúc ở 256
kbps cần khoảng 25,6 Mbps chiều ra liên tục, chưa tính đỉnh. Hầu hết VPS giá rẻ giới hạn tổng lưu
lượng tháng ở mức 1-4 TB — bảng trên cho thấy quy mô vài trăm người dùng thường xuyên đã chạm
trần đó. Kết luận: kiến trúc này rẻ ở quy mô cá nhân và đắt dần một cách tuyến tính, không có hiệu
ứng quy mô — nó không "rẻ hơn khi đông người" như dịch vụ dùng CDN thông thường.

8 Pháp lý và giấy phép

   Khuyến nghị chính thức của tài liệu: Đây là kế hoạch kỹ thuật cho mục đích học tập và sử dụng cá
   nhân. Không thương mại hóa, không quảng bá rộng rãi, không thu phí người dùng dựa trên nội
   dung lấy từ YouTube khi vị thế pháp lý chưa rõ ràng.


8.1 Điều khoản YouTube
Phát nội dung YouTube tách khỏi trình phát chính thức, bỏ qua quảng cáo và cơ chế phân phối của
YouTube là vi phạm Điều khoản Dịch vụ của YouTube. Hệ quả thực tế có thể gặp: chặn IP, chặn cơ
chế truy cập, khiếu nại và yêu cầu gỡ bỏ nếu triển khai công khai. Chính dự án SimpMusic cũng ghi rõ
người dùng tự chịu trách nhiệm tuân thủ luật bản quyền và điều khoản tại nơi cư trú, đồng thời
khuyến khích mua YouTube Premium. Tài liệu này không phải tư vấn pháp lý; khi cân nhắc triển khai
công khai, cần ý kiến luật sư thực thụ.

8.2 Nghĩa vụ GPL-3.0 từ code SimpMusic
   SimpMusic phát hành theo GPL-3.0. Nếu sản phẩm phái sinh có chứa code của dự án (scraper,
   domain) được phân phối cho người khác, nghĩa vụ GPL được kích hoạt: phải cung cấp mã nguồn
   tương ứng theo cùng giấy phép GPL-3.0, giữ thông báo bản quyền và giấy phép gốc.
   Vận hành dưới dạng dịch vụ web (người dùng chỉ truy cập qua mạng, không nhận phần mềm) là
   tình huống mà GPL-3.0 truyền thống không tự động buộc công bố mã nguồn server như AGPL —
   tuy nhiên ranh giới này cần được hiểu cẩn thận, và lựa chọn an toàn, minh bạch là công bố mã
   nguồn của phần backend dùng code GPL ngay từ đầu.
   Không gỡ bỏ thông tin tác giả gốc, không đổi giấy phép của phần code vay mượn, và ghi rõ trong
   trang giới thiệu của website rằng dự án dựa trên SimpMusic.

Website phát nhạc YouTube — Kiến trúc & Kế hoạch triển khai                                       Trang 13
9 Kế hoạch triển khai theo giai đoạn
Ước tính cho 1 lập trình viên làm việc tập trung. [Ước tính] Thời gian là khoảng làm việc thực tế, không tính thời gian
chờ YouTube / upstream thay đổi. Thứ tự phụ thuộc là cứng: giai đoạn sau không bắt đầu khi tiêu chí nghiệm thu của
giai đoạn trước chưa đạt.

 Giai đoạn           Thời gian            Nội dung và tiêu chí nghiệm thu

 GĐ 0 — Spike        1-3 ngày             Nội dung: Tách scraper chạy độc lập trên JVM, một endpoint stream tối
 khả thi             Tuần 1               thiểu, triển khai lên VPS đích, chạy bộ bài thử đa dạng, lặp lại 3 ngày.
                                          Nghiệm thu: Đạt tiêu chí PASS ở Mục 7.2 kèm báo cáo số liệu thật (tỷ lệ
                                          thành công, lỗi, độ trễ). FAIL thì dừng hoặc chuyển phương án B — không
                                          sang GĐ 1.

 GĐ 1 —              1-2 tuần             Nội dung: Ktor API đầy đủ theo Mục 5 (trừ auth), stream proxy hoàn chỉnh
 Backend MVP         Tuần 2-3             (Range, chọn format, cache metadata, refresh 403), Redis cache, rate limit
                                          cơ bản, log và health-check.
                                          Nghiệm thu: Mọi endpoint trả dữ liệu thật; phát và tua bài ổn định qua API
                                          bằng công cụ kiểm thử; tỷ lệ lỗi stream trong kiểm thử nội bộ < 5%; có test
                                          tự động cho parser và resolve luồng.

 GĐ 2 —              2-3 tuần             Nội dung: Trang chủ, tìm kiếm, trang album / nghệ sĩ / playlist, player
 Frontend MVP        Tuần 4-6             (phát, tạm dừng, tua, next / previous, hàng đợi), lời nhạc đồng bộ, giao diện
                                          mobile + desktop, trạng thái lỗi thân thiện khi stream gãy.
                                          Nghiệm thu: Một người dùng mới vào web có thể tìm và nghe trọn một
                                          album mà không cần hướng dẫn; phát liên tục 10 bài không gián đoạn bất
                                          thường; dùng được trên Safari iOS và Chrome Android.




Website phát nhạc YouTube — Kiến trúc & Kế hoạch triển khai                                                          Trang 14
 Giai đoạn           Thời gian              Nội dung và tiêu chí nghiệm thu

 GĐ 3 — Tài          1-2 tuần               Nội dung: Đăng ký / đăng nhập, playlist tự tạo, yêu thích, lịch sử nghe, đồng
 khoản & cá          Tuần 7-8               bộ hàng đợi, trang cài đặt và xóa dữ liệu cá nhân.
 nhân hóa                                   Nghiệm thu: Dữ liệu cá nhân tách bạch đúng theo tài khoản; đăng xuất / đổi
                                            thiết bị không mất playlist; người dùng tự xóa được toàn bộ lịch sử của mình.

 GĐ 4 — Cứng         1-2 tuần + liên        Nội dung: Monitoring và cảnh báo (đặc biệt: tỷ lệ 403 tăng đột biến = dấu hiệu
 hóa vận hành        tục                    YouTube đổi thuật toán hoặc IP bị chặn), tiến trình cập nhật scraper theo
                     Tuần 9-10              upstream, CI/CD, sao lưu PostgreSQL tự động, giới hạn lạm dụng chặt hơn, tài
                                            liệu vận hành.
                                            Nghiệm thu: Khi stream gãy hàng loạt, hệ thống tự báo động trước khi người
                                            dùng báo; khôi phục từ bản sao lưu thành công trong diễn tập; triển khai phiên
                                            bản mới không downtime đáng kể.

Tổng thời gian tới MVP dùng được (GĐ 0-2): khoảng 4-6 tuần. Tới bản đầy đủ (GĐ 0-4): khoảng 8-
10 tuần cho 1 lập trình viên. [Ước tính] Con số này chưa tính các đợt gián đoạn do YouTube thay đổi
— trong thực tế nên dự phòng thêm 20-30% thời gian cho việc sửa gãy phát sinh.

9.1 Hạ tầng đề xuất [Đề xuất]

 Hạng mục                              Đề xuất

 Máy chủ                               1 VPS tối thiểu 2 vCPU / 4 GB RAM cho MVP (quy mô cá nhân — nhóm nhỏ). Tách
                                       database ra máy riêng chỉ khi người dùng tăng thật.

 Đóng gói                              Docker Compose: backend Ktor, PostgreSQL, Redis, reverse proxy — một bộ cấu
                                       hình chạy giống hệt trên máy phát triển và server.

 Reverse proxy & HTTPS                 Nginx hoặc Caddy (Caddy tự động cấp chứng chỉ HTTPS), giới hạn kết nối đồng thời
                                       tại lớp proxy như một lớp bảo vệ phụ cho endpoint stream.

 Tên miền & DNS                        Một tên miền riêng; không dùng subdomain của dịch vụ miễn phí cho bản vận hành
                                       thật vì uy tín IP / domain ảnh hưởng tới việc bị chặn.


9.2 Chi phí vận hành hàng tháng [Ước tính]

 Hạng mục                                     Cá nhân / nhóm nhỏ             Quy mô vừa (vài trăm người dùng)

 VPS                                          5-15 USD / tháng               20-60 USD / tháng

 Băng thông vượt gói (nếu có)                 Thường 0 — nằm trong           10-100+ USD / tháng, biến động mạnh theo
                                              gói                            giờ nghe

 Tên miền                                     ~1 USD / tháng (trả theo       ~1 USD / tháng
                                              năm)

 Residential proxy (chỉ khi cần phương        15-50+ USD / tháng             Thường không khả thi về chi phí
 án B)

 Tổng tham khảo                               Khoảng 6-20 USD / tháng        Khoảng 30-160+ USD / tháng

Mọi con số trong mục này là ước tính tham khảo tại thời điểm viết (10/2026), thay đổi theo nhà cung cấp, khu vực máy
chủ và mức sử dụng thật. Yếu tố khó đoán nhất luôn là băng thông và nhu cầu proxy dự phòng.




Website phát nhạc YouTube — Kiến trúc & Kế hoạch triển khai                                                             Trang 15
10 Phụ lục

Phụ lục A — Ánh xạ module SimpMusic sang thành phần website

 Module / thành phần gốc                    Quyết định         Ghi chú

 core/service/kotlinYtmusicScraper          Dùng lại           Chạy trên backend JVM; đóng băng phiên bản tại
                                                               commit 068d744 khi bắt đầu

 core/domain (model, repository             Dùng lại           Chuẩn dữ liệu cho toàn bộ backend
 interface)

 lyricsService                              Dùng lại           Phục vụ /api/lyrics

 spotify service                            Dùng lại có điều   Cần API key và chấp nhận quota của Spotify
                                            kiện

 composeApp                                 Viết mới           Frontend web bằng React / Next.js; chỉ tham khảo
                                                               luồng màn hình

 Media3 / ExoPlayer (Android)               Viết mới           Thay bằng HTML5 audio + Web Audio API

 libmpv player (Desktop)                    Bỏ                 Không có vai trò trong kiến trúc web

 Room database                              Tham khảo          Thay bằng PostgreSQL ở server

 listenTogether, loginSync, cast, lastfm    Bỏ ở MVP           Cân nhắc lại ở giai đoạn mở rộng nếu MVP thành công


Phụ lục B — Checklist quyết định cần chốt trước khi bắt đầu
☐ Mục đích sử dụng là cá nhân / nhóm nhỏ hay công khai? Nếu công khai, đã chấp nhận rủi ro ở
Mục 8 chưa?
☐ Đã đọc và chấp nhận nghĩa vụ GPL-3.0 khi dùng code SimpMusic chưa? Có công bố mã nguồn
phần backend không?
☐ Ngân sách băng thông tối đa mỗi tháng là bao nhiêu? Tương ứng với bao nhiêu giờ nghe (Mục
7.3)?
☐ Nhà cung cấp VPS và IP cụ thể dùng cho Giai đoạn 0 đã chọn chưa? (Đổi VPS sau spike đồng
nghĩa phải spike lại.)
☐ Nếu spike FAIL, chọn phương án B nào — hay chấp nhận dừng dự án?
☐ Có chấp nhận việc hệ thống sẽ gãy định kỳ khi YouTube thay đổi và cần thời gian bảo trì liên tục
không?
☐ Phạm vi MVP có bị cắt đúng như Mục 1.2 không, hay đang ôm thêm tính năng?
☐ Ai là người theo dõi cảnh báo và cập nhật scraper theo upstream SimpMusic về lâu dài?


   Bước tiếp theo duy nhất được khuyến nghị: Thực hiện Giai đoạn 0 — dựng spike kiểm chứng
   stream trên VPS đích trong 1-3 ngày và ra quyết định đi tiếp / dừng dựa trên số liệu thật, trước khi
   đầu tư bất kỳ công sức nào vào giao diện.

Tài liệu dựa trên phân tích mã nguồn SimpMusic (github.com/maxrave-dev/SimpMusic, nhánh dev, commit 068d744,
phiên bản 2.4.0, giấy phép GPL-3.0) thực hiện ngày 26/10/2026. Các nội dung đánh dấu [Đề xuất] và [Ước tính] là đóng
góp của tài liệu này, không phải thông tin từ dự án gốc.



Website phát nhạc YouTube — Kiến trúc & Kế hoạch triển khai                                                   Trang 16
