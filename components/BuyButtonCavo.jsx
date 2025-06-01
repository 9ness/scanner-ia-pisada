// components/BuyButtonCavo.jsx
import { useEffect } from 'react';

const BuyButtonCavo = () => {
  useEffect(() => {
    const scriptId = 'shopify-buy-button-script';

    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.src = 'https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js';
      script.async = true;
      script.id = scriptId;
      script.onload = renderBuyButton;
      document.body.appendChild(script);
    } else {
      renderBuyButton();
    }

    function renderBuyButton() {
      if (!window.ShopifyBuy) return;
      if (window.ShopifyBuy.UI) {
        const client = window.ShopifyBuy.buildClient({
          domain: '0ssfqf-rv.myshopify.com',
          storefrontAccessToken: 'c055a6bf600ea75fe12442dfe7b29285',
        });

        window.ShopifyBuy.UI.onReady(client).then((ui) => {
          ui.createComponent('product', {
            id: '15032879579462',
            node: document.getElementById('product-component-cavo'),
            moneyFormat: '%E2%82%AC%7B%7Bamount_with_comma_separator%7D%7D',
            options: {
              product: {
                styles: {
                  product: {
                    '@media (min-width: 601px)': {
                      'max-width': 'calc(25% - 20px)',
                      'margin-left': '20px',
                      'margin-bottom': '50px',
                    },
                  },
                  title: {
                    'font-family': 'Open Sans, sans-serif',
                  },
                  button: {
                    'border-radius': '15px',
                  },
                  price: { color: '#3e3e3e' },
                  compareAt: { color: '#3e3e3e' },
                  unitPrice: { color: '#3e3e3e' },
                },
                buttonDestination: 'modal',
                contents: {
                  button: false,
                  options: false,
                },

                text: { button: 'Ver producto' },
                googleFonts: ['Open Sans'],
              },
              modalProduct: {
                contents: {
                  img: false,
                  imgWithCarousel: true,
                  button: false,
                  buttonWithQuantity: true,
                },
                styles: {
                  product: {
                    '@media (min-width: 601px)': {
                      'max-width': '100%',
                      'margin-left': '0px',
                      'margin-bottom': '0px',
                    },
                  },
                  button: { 'border-radius': '15px' },
                  title: {
                    'font-family': 'Helvetica Neue, sans-serif',
                    'font-weight': 'bold',
                    'font-size': '26px',
                    color: '#4c4c4c',
                  },
                  price: {
                    'font-family': 'Helvetica Neue, sans-serif',
                    'font-weight': 'normal',
                    'font-size': '18px',
                    color: '#4c4c4c',
                  },
                },
              },
              cart: {
                styles: { button: { 'border-radius': '15px' } },
                text: {
                  title: 'Carrito',
                  total: 'Subtotal',
                  empty: 'Su cesta está vacía.',
                  notice: 'Los códigos de descuento se añaden al finalizar la compra.',
                  button: 'Pedido',
                },
                popup: false,
              },
            },
          });
        });
      }
    }
  }, []);

  return <div id="product-component-cavo" />;
};

export default BuyButtonCavo;
