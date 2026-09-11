export const metadata = {
  title: "OrangeSoft — Software, AI & Digital Products",
  description: "OrangeSoft Ltd builds software, AI-powered tools, and digital products.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
