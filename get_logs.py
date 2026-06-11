import sys

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.desired_capabilities import DesiredCapabilities
except ImportError:
    print("selenium not installed")
    sys.exit(0)

print("Selenium is installed, attempting to start chrome...")
options = Options()
options.add_argument('--headless')
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')

try:
    # enable browser logging
    options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
    driver = webdriver.Chrome(options=options)
    driver.get('http://localhost:8080')
    print("Page title:", driver.title)
    
    # get logs
    logs = driver.get_log('browser')
    print("Console logs:")
    for entry in logs:
        print(entry)
    driver.quit()
except Exception as e:
    print("Error during execution:", e)
