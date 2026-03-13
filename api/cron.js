export default async function handler(req, res) {

  console.log("Cron job started");

  // Example task
  const response = await fetch("https://api.example.com/data")
  const data = await response.json()

  console.log(data);

  res.status(200).json({
    success: true,
    message: "Cron executed"
  });

}