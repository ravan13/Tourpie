import resend

resend.api_key = "re_LfPWz9CQ_L86YiVZ9AH13bUDkgKkQw4pV"

try:
    response = resend.Emails.send({
        "from": "TourPie <noreply@send.tourpie.com>",
        "to": ["ravanbeybudov+tourpie20260718debug003@gmail.com"],
        "subject": "SDK Test",
        "html": "<strong>Hello from Resend SDK</strong>",
    })

    print(response)

except Exception as e:
    print(type(e))
    print(e)