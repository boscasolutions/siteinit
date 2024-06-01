openssl req -x509 -nodes -days 730 -newkey rsa:2048 -keyout key.pem -out cert.pem -config san.cnf
openssl x509 -in cert.pem -text -noout
openssl pkey -in key.pem -out net2.key
openssl crl2pkcs7 -nocrl -certfile cert.pem | openssl pkcs7 -print_certs -out net2.crt
sudo cp cert.pem /home/bosca/cert.pem
sudo cp key.pem /home/bosca/key.pem
sudo cp cert.pem /usr/local/share/ca-certificates/local-ca.crt
sudo update-ca-certificates