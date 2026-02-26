"""
Check Twilio Account Status and Balance
"""
import os
from dotenv import load_dotenv

load_dotenv()

TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')

print("=" * 70)
print("TWILIO ACCOUNT STATUS")
print("=" * 70)

try:
    from twilio.rest import Client
    
    client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    
    # Get account details
    account = client.api.accounts(TWILIO_ACCOUNT_SID).fetch()
    
    print(f"\n📋 Account Information:")
    print(f"   Name: {account.friendly_name}")
    print(f"   Status: {account.status}")
    print(f"   Type: {account.type}")
    print(f"   SID: {account.sid}")
    
    # Get balance
    try:
        balance = client.balance.fetch()
        print(f"\n💰 Account Balance:")
        print(f"   Balance: ${balance.balance}")
        print(f"   Currency: {balance.currency}")
    except:
        print(f"\n💰 Balance: Check at https://console.twilio.com/billing")
    
    # Check if trial
    if account.type == "Trial":
        print(f"\n⚠️  TRIAL ACCOUNT DETECTED")
        print(f"   ")
        print(f"   Trial accounts can only send SMS to VERIFIED phone numbers")
        print(f"   ")
        print(f"   🔧 TO FIX:")
        print(f"   1. Verify phone: https://console.twilio.com/us1/develop/phone-numbers/manage/verified")
        print(f"   2. Or upgrade: https://console.twilio.com/billing")
    else:
        print(f"\n✅ Full Account - No restrictions!")
    
    # List verified phone numbers
    print(f"\n📱 Verified Phone Numbers:")
    try:
        verified_numbers = client.validation_requests.list(limit=20)
        if verified_numbers:
            for validation in verified_numbers:
                print(f"   ✓ {validation.phone_number}")
        else:
            # Try another way
            print(f"   Check at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified")
    except:
        print(f"   Check at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified")
    
    print(f"\n" + "=" * 70)
    print(f"NEXT STEPS:")
    print(f"=" * 70)
    print(f"\n1. Verify patient number +917075923575:")
    print(f"   https://console.twilio.com/us1/develop/phone-numbers/manage/verified")
    print(f"\n2. Or upgrade to remove all restrictions:")
    print(f"   https://console.twilio.com/billing")
    print(f"\n3. Then test again:")
    print(f"   python test_patient_sms.py")
    print()
    
except Exception as e:
    print(f"\n✗ Error: {e}")
    print(f"\nCheck your Twilio console: https://console.twilio.com")
