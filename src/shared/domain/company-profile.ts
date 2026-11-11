/** What the printed documents say about the company (D26): notes, receipts and statements. */
export type CompanyProfile = {
  /** The brand printed on the forms. */
  brand: string;
  legalName: string;
  taxId: string;
  city: string;
  country: string;
  phone: string;
  mobile: string;
  email: string;
  website: string;
  facebook: string;
};

/** The details Agrosoil gave us and those printed on its forms; administration can change them. */
export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  brand: "Agrosoil Bolivia",
  legalName: "AGROSOILBOLIVIA S.R.L.",
  taxId: "410408021",
  city: "Santa Cruz",
  country: "Bolivia",
  phone: "3427958",
  mobile: "68767600 - 72142142",
  email: "agrosoilbolivia@gmail.com",
  website: "www.agrosoilbolivia.com",
  facebook: "Agrosoil Bolivia",
};
