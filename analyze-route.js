export const access = 'public';
export const methods = ['POST'];

export default async function(req, res) {
  try {
    const response = await fetch('https://gbxdgy9b09.execute-api.ap-south-1.amazonaws.com/analyze-route', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();

    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: 'Unable to connect to Climora AI engine',
      details: error.message
    });
  }
}