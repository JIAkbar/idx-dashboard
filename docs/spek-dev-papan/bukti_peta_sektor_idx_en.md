# BUKTI: peta klasifikasi IDX-IC Indonesia to Inggris (RESMI, dari IDX)

Diambil 27 Agu 2026 dari endpoint yang SAMA yang sudah dipakai `panen_sektor_idx.py`:

```
GET https://www.idx.co.id/primary/ListedCompany/GetCompanyProfiles
    ?emitenType=s&start=0&length=1200&lang=en
Referer: https://www.idx.co.id/en
```

Parameter pembeda: **`lang=en`**. Parameter lain yang DICOBA dan TIDAK berpengaruh (tetap Indonesia): `language=en-us`, `locale=en`, dan Referer `/en` sendirian.

Uji silang 962 emiten Inggris lawan 962 emiten Indonesia: irisan 962, nol emiten hanya-satu-bahasa, nol baris kosong, dan **nol ambiguitas di kedua arah** pada keempat tingkat.


## Sektor (11)

| Indonesia | Inggris |
|---|---|
| Barang Baku | Basic Materials |
| Barang Konsumen Non-Primer | Consumer Cyclicals |
| Barang Konsumen Primer | Consumer Non-Cyclicals |
| Energi | Energy |
| Infrastruktur | Infrastructures |
| Kesehatan | Healthcare |
| Keuangan | Financials |
| Perindustrian | Industrials |
| Properti & Real Estat | Properties & Real Estate |
| Teknologi | Technology |
| Transportasi & Logistik | Transportation & Logistic |

## Subsektor (33)

| Indonesia | Inggris |
|---|---|
| Asuransi | Insurance |
| Bank | Banks |
| Barang Baku | Basic Materials |
| Barang Perindustrian | Industrial Goods |
| Barang Rekreasi | Leisure Goods |
| Barang Rumah Tangga | Household Goods |
| Energi Alternatif | Alternative Energy |
| Farmasi & Riset Kesehatan | Pharmaceuticals & Health Care Research |
| Infrastruktur Transportasi | Transportation Infrastructure |
| Jasa & Peralatan Kesehatan | Healthcare Equipment & Providers |
| Jasa Investasi | Investment Service |
| Jasa Konsumen | Consumer Services |
| Jasa Pembiayaan | Financing Service |
| Jasa Perindustrian | Industrial Services |
| Konstruksi Bangunan | Heavy Constructions & Civil Engineering |
| Logistik & Pengantaran | Logistics & Deliveries |
| Makanan & Minuman | Food & Beverage |
| Media & Hiburan | Media & Entertainment |
| Minyak, Gas & Batu Bara | Oil, Gas & Coal |
| Otomotif & Komponen Otomotif | Automobiles & Components |
| Pakaian & Barang Mewah | Apparel & Luxury Goods |
| Perangkat Keras & Peralatan Teknologi | Technology Hardware & Equipment |
| Perangkat Lunak & Jasa TI | Software & IT Services |
| Perdagangan Ritel | Retailing |
| Perdagangan Ritel Barang Primer | Food & Staples Retailing |
| Perusahaan Holding & Investasi | Holding & Investment Companies |
| Perusahaan Holding Multi Sektor | Multi-sector Holdings |
| Produk Rumah Tangga Tidak Tahan Lama | Nondurable Household Products |
| Properti & Real Estat | Properties & Real Estate |
| Rokok | Tobacco |
| Telekomunikasi | Telecommunication |
| Transportasi | Transportation |
| Utilitas | Utilities |

## Industri (58)

| Indonesia | Inggris |
|---|---|
| Aplikasi & Jasa Internet | Online Applications & Services |
| Asuransi | Insurance |
| Bank | Banks |
| Barang Elektronik Konsumen | Consumer Electronics |
| Barang Kimia | Chemicals |
| Barang Rumah Tangga | Household Goods |
| Batu Bara | Coal |
| Department Store | Department Stores |
| Distributor Barang Konsumen | Consumer Distributors |
| Farmasi | Pharmaceuticals |
| Hiburan & Film | Entertainment & Movie Production |
| Jasa & Konsultan TI | IT Services & Consulting |
| Jasa Investasi | Investment Services |
| Jasa Komersial | Commercial Services |
| Jasa Profesional | Professional Services |
| Jasa Telekomunikasi | Telecommunication Service |
| Jasa Telekomunikasi Nirkabel | Wireless Telecommunication Services |
| Kelistrikan | Electrical |
| Komponen Otomotif | Auto Components |
| Konstruksi Bangunan | Heavy Constructions & Civil Engineering |
| Logam & Mineral | Metals & Minerals |
| Logistik & Pengantaran | Logistics & Deliveries |
| Makanan Olahan | Processed Foods |
| Maskapai Penerbangan | Airlines |
| Material Konstruksi | Construction Materials |
| Media | Media |
| Mesin | Machinery |
| Minuman | Beverages |
| Minyak & Gas | Oil & Gas |
| Operator Infrastruktur Transportasi | Transport Infrastructure Operator |
| Pakaian & Barang Mewah | Apparel & Luxury Goods |
| Pariwisata & Rekreasi | Tourism & Recreation |
| Pembiayaan Konsumen | Consumer Financing |
| Pendidikan & Jasa Penunjang | Education & Support Services |
| Pendukung Minyak, Gas & Batu Bara | Oil, Gas & Coal Supports |
| Pengangkutan Darat Penumpang | Passenger Land Transportation |
| Pengelola & Pengembang Real Estat | Real Estate Management & Development |
| Penyedia Jasa Kesehatan | Healthcare Providers |
| Peralatan & Perlengkapan Kesehatan | Healthcare Equipment & Supplies |
| Peralatan Energi Alternatif | Alternative Energy Equipment |
| Peralatan Jaringan | Networking Equipment |
| Peralatan Olah Raga & Barang Hobi | Sport Equipment & Hobbies Goods |
| Perangkat Komputer | Computer Hardware |
| Perangkat Lunak | Software |
| Perangkat, Instrumen & Komponen Elektronik | Electronic Equipment, Instruments & Components |
| Perdagangan Aneka Barang Perindustrian | Diversified Industrial Trading |
| Perdagangan Ritel Barang Primer | Food & Staples Retailing |
| Perhutanan & Kertas | Forestry & Paper |
| Perusahaan Holding & Investasi | Holding & Investment Companies |
| Perusahaan Holding Multi-sektor | Multi-sector Holdings |
| Produk & Perlengkapan Bangunan | Building Products & Fixtures |
| Produk Makanan Pertanian | Agricultural Products |
| Produk Perawatan Tubuh | Personal Care Products |
| Ritel Khusus | Specialty Retail |
| Rokok | Tobacco |
| Utilitas Gas | Gas Utilities |
| Utilitas Listrik | Electric Utilities |
| Wadah & Kemasan | Containers & Packaging |

## Subindustri (102)

| Indonesia | Inggris |
|---|---|
| Agen Perjalanan | Travel Agencies |
| Alas Kaki | Footwear |
| Alumunium | Aluminum |
| Aplikasi & Jasa Internet | Online Applications & Services |
| Asuransi Jiwa | Life Insurance |
| Asuransi Umum | General Insurance |
| Baja & Besi | Iron & Steel |
| Ban | Tires |
| Bank | Banks |
| Bank Investasi & Perantara Perdagangan | Investment Banking & Brokerage Services |
| Barang Elektronik Konsumen | Consumer Electronics |
| Barang Kimia Dasar | Basic Chemicals |
| Barang Kimia Khusus | Specialty Chemicals |
| Barang Kimia Pertanian | Agricultural Chemicals |
| Department Store | Department Stores |
| Distribusi Batu Bara | Coal Distribution |
| Distributor Barang Konsumen | Consumer Distributors |
| Emas | Gold |
| Farmasi | Pharmaceuticals |
| Fasilitas Rekreasi & Olah Raga | Recreational & Sports Facilities |
| Hiburan & Film | Entertainment & Movie Production |
| Hotel, Resor & Kapal Pesiar | Hotels, Resorts & Cruise Lines |
| Ikan, Daging & Produk Unggas | Fish, Meat, & Poultry |
| Jasa & Konsultan TI | IT Services & Consulting |
| Jasa & Perlengkapan Minyak, Gas & Batu Bara | Oil, Gas & Coal Equipment & Services |
| Jasa Pendidikan | Education Services |
| Jasa Pendukung Bisnis | Business Support Services |
| Jasa Penelitian & Konsultasi | Research & Consulting Services |
| Jasa Pengeboran Minyak & Gas | Oil & Gas Drilling Service |
| Jasa Pengelolaan Lingkungan & Sarana | Environmental & Facilities Services |
| Jasa Personalia | Human Resource & Employment Services |
| Jasa Real Estat | Real Estate Services |
| Jasa Telekomunikasi Kabel | Wired Telecommunication Service |
| Jasa Telekomunikasi Nirkabel | Wireless Telecommunication Services |
| Jasa Telekomunikasi Terintegrasi | Integrated Telecommunication Service |
| Kayu | Timber |
| Kertas | Paper |
| Komponen & Peralatan Kelistrikan | Electrical Components & Equipment |
| Konstruksi Bangunan | Heavy Constructions & Civil Engineering |
| Logam & Mineral Lainnya | Diversified Metals & Minerals |
| Logistik & Pengantaran | Logistics & Deliveries |
| Makanan Olahan | Processed Foods |
| Manajemen Investasi | Investment Management |
| Maskapai Penerbangan | Airlines |
| Material Konstruksi | Construction Materials |
| Mesin & Komponen Perindustrian | Industrial Machinery & Components |
| Mesin Konstruksi & Kendaraan Berat | Construction Machinery & Heavy Vehicles |
| Minuman Keras | Liquors |
| Minuman Ringan | Soft Drinks |
| Operator Bandar Udara | Airport Operators |
| Operator Jalan Tol & Rel | Highways & Railtracks |
| Operator Pelabuhan | Marine Ports & Services |
| Pakaian, Aksesoris, & Tas | Clothing, Accessories & Bags |
| Pembiayaan Konsumen | Consumer Financing |
| Penerbitan | Consumer Publishing |
| Pengembang & Operator Real Estat | Real Estate Development & Management |
| Penyedia & Distribusi Perlengkapan Kesehatan | Healthcare Supplies & Distributions |
| Penyedia Jasa Kesehatan | Healthcare Providers |
| Penyiaran | Broadcasting |
| Penyiaran Berbayar | Cable & Satellite |
| Penyimpanan & Distribusi Minyak & Gas | Oil & Gas Storage & Distribution |
| Peralatan Energi Alternatif | Alternative Energy Equipment |
| Peralatan Jaringan | Networking Equipment |
| Peralatan Kantor | Office Supplies |
| Peralatan Kesehatan | Healthcare Equipment |
| Peralatan Olah Raga & Barang Hobi | Sport Equipment & Hobbies Goods |
| Peralatan Rumah Tangga | Household Appliances |
| Perangkat & Instrumen Elektronik | Electronic Equipment & Instruments |
| Perangkat Komputer | Computer Hardware |
| Perangkat Lunak | Software |
| Percetakan Komersial | Commercial Printing |
| Perdagangan Aneka Barang Perindustrian | Diversified Industrial Trading |
| Periklanan | Advertising |
| Perkebunan & Tanaman Pangan | Plantations & Crops |
| Perlengkapan Rumah Tangga | Housewares & Specialties |
| Perusahaan Holding Keuangan | Financial Holdings |
| Perusahaan Holding Multi-sektor | Multi-sector Holdings |
| Perusahaan Investasi | Investment Companies |
| Produk & Perlengkapan Bangunan | Building Products & Fixtures |
| Produk Hutan Lainnya | Diversified Forest |
| Produk Perawatan Tubuh | Personal Care Products |
| Produk Susu Olahan | Dairy Products |
| Produksi & Penyulingan Minyak & Gas | Oil & Gas Production & Refinery |
| Produksi Batu Bara | Coal Production |
| Produsen Furnitur Rumah | Home Furnishings |
| Reasuransi | Reinsurance |
| Ritel & Distributor Makanan | Food Retail & Distributors |
| Ritel & Distributor Obat-obatan | Drug Retail & Distributors |
| Ritel Barang Rumah Tangga | Home Improvement Retail |
| Ritel Elektronik | Electronics Retail |
| Ritel Otomotif | Automotive Retail |
| Ritel Pakaian & Tekstil | Apparel & Textile Retail |
| Rokok | Tobacco |
| Rumah Makan | Restaurants |
| Suku Cadang Otomotif | Auto Parts & Equipment |
| Supermarket | Supermarkets & Convenience Store |
| Tekstil | Textiles |
| Tembaga | Cooper |
| Transportasi Jalanan | Road Transportation |
| Utilitas Gas | Gas Utilities |
| Utilitas Listrik | Electric Utilities |
| Wadah & Kemasan | Containers & Packaging |
