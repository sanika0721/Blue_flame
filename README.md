# BLUE FLAME · LPG Distribution ERP

Blue Flame is a React + TypeScript + Vite LPG distributorship demo. Login, registration, customer profiles, customer bookings, and supplier booking status changes use accounts and data saved in the current browser. The app does not connect to Supabase or another remote database.

## Run locally

```sh
npm install
npm run dev
```

No environment variables are required.

## Local accounts

- Choose **Customer** or **Supplier**, then use **Register** to create a browser-local account or **Login** with an account already registered in this browser.
- Customer registration stores the customer's name, phone, village and customer ID. Each customer sees only their own browser-local profile and bookings.
- Supplier login opens the existing ERP menu and can view bookings created by customer accounts in the same browser.
- **Continue with Google** is displayed but not connected; it explains that local email/password login is required.
- Passwords are locally derived into hashes, but this is not server-side authentication. Browser data can be modified or cleared and does not sync across devices. Do not use real customer, payment or staff data.

## Customer bookings

The customer dashboard has **Book Now** with Indane, HP Gas, and Bharatgas; it validates a manually entered unique booking ID and saves COD bookings in browser storage. The success notification is shown only after the local save succeeds.

Supplier Dashboard and Bookings views show customer bookings saved in that browser and allow status changes through Booked → Accepted → Preparing for Dispatch → Dispatched → Delivered. These changes are local and are not server-authorized.

## Demo limitations

Other supplier ERP menu screens still contain fictional sample data. Customer bookings are separate browser-local data and are not automatically merged with those sample records. Demo accounts and bookings are isolated to the current browser profile.

## Build

```sh
npm run build
npm run preview
```
